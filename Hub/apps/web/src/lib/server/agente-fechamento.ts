import 'server-only';
import { getDb, sql } from '@hexxa/db';
import {
  fecharMesComConferencia,
  coletarDadosDoMes,
  escriturarPendentes,
  reapurarResultado,
  fecharParaOCliente,
  type FechamentoAgente,
} from '@hexxa/db';
import { verificarFechamento, TaxThermometerService } from '@hexxa/core';
import { taxGuide } from '@hexxa/db/schema';
import { getSimplesInputs } from './fiscal';
import { classificarPendentes } from './agente-classificador';
import { escriturar } from './ledger';

/**
 * AGENTE DE FECHAMENTO QUE RESOLVE, E SÓ DEPOIS PERGUNTA.
 *
 * A versão anterior conferia o mês e devolvia uma lista de pendências. Estava
 * certa como conferência e errada como produto: o cliente desta ferramenta é
 * um profissional autônomo que entende do negócio dele, não de contabilidade.
 * Mandar para ele "1 lançamento sem classificação contábil → classifique"
 * é devolver a ele o trabalho que a ferramenta existe para fazer.
 *
 * A ordem agora é: **tenta resolver tudo que dá, confere de novo, e só então
 * pergunta o que sobrou.** E o que sobra, na prática, é uma coisa só — se o
 * dinheiro que entrou tinha nota fiscal. Isso nenhuma IA responde: só quem
 * prestou o serviço sabe.
 *
 * O contrato com o cliente fica sendo: **você lança, a gente fecha.** Se ele
 * não lançar, não tem balanço — e isso precisa ficar claro, mas é a única
 * exigência.
 */

export interface FechamentoResolvido extends FechamentoAgente {
  /** O que a IA consertou antes de conferir de novo. */
  resolvido: { pendencia: string; acao: string }[];
  /** O que ficou e não dá para resolver sem o cliente. */
  aindaPrecisaDoCliente: { id: string; mensagem: string }[];
  /** O mês foi trancado para o cliente? */
  trancado: boolean;
  motivoNaoTrancou?: string;
}

/**
 * Provisiona a guia do mês a partir do faturamento e da posição no Simples.
 *
 * A IA tem tudo que precisa: faturamento do mês, RBT12 e folha dos últimos 12.
 * Perguntar ao cliente quanto de imposto ele deve seria o avesso do produto —
 * é exatamente o que ele contratou a ferramenta para não ter que saber.
 */
async function provisionarGuia(companyId: string, referenceMonth: string, receita: number) {
  const db = getDb();

  const [existente] = (await db.execute(sql`
    SELECT id FROM tax_guide
    WHERE company_id = ${companyId} AND reference_month = ${referenceMonth}::date
  `)) as unknown as { id: string }[];
  if (existente) return null;

  const [comp] = (await db.execute(sql`
    SELECT type::text AS type FROM company WHERE id = ${companyId}
  `)) as unknown as { type: string }[];

  const { rbt12, folha12 } = await getSimplesInputs({
    companyId,
    companyType: (comp?.type ?? 'SERVICE') as 'SERVICE' | 'HOLDING',
    userId: 'agente-fechamento',
  });

  const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });
  const valor = (receita * simples.nominalRate) / 100;
  if (valor <= 0) return null;

  // Vencimento no dia 20 do mês seguinte ao de referência — prazo do DAS.
  const [ano, mes] = referenceMonth.split('-').map(Number);
  const venc = new Date(Date.UTC(ano!, mes!, 20)).toISOString().slice(0, 10);

  const [guia] = await db
    .insert(taxGuide)
    .values({
      companyId,
      taxName: 'DAS - Simples Nacional',
      referenceMonth,
      amount: valor.toFixed(2),
      dueDate: venc,
      status: 'OPEN',
    })
    .returning({ id: taxGuide.id });

  // Escritura a provisão na mesma passada: despesa contra imposto a recolher.
  await escriturar('guia', companyId, guia!.id, null);

  return {
    pendencia: 'guia_nao_provisionada',
    acao:
      `Apurado DAS de R$ ${valor.toFixed(2)} (Anexo ${simples.anexo}, faixa ${simples.faixa}, ` +
      `alíquota ${simples.nominalRate.toFixed(2)}%) e provisionado no razão.`,
  };
}

/**
 * Fecha o mês resolvendo o que der.
 *
 * Duas passadas de propósito: a primeira conferência descobre o que falta, o
 * agente conserta, e a segunda conferência é a que vale. Conferir uma vez só,
 * antes de resolver, reportaria como pendência do cliente aquilo que a própria
 * IA ia consertar em seguida.
 */
export async function fecharMesResolvendo(
  companyId: string,
  referenceMonth: string,
  opts: { trigger?: 'CRON' | 'USER' | 'API'; userId?: string | null } = {},
): Promise<FechamentoResolvido> {
  const db = getDb();
  const resolvido: FechamentoResolvido['resolvido'] = [];

  // ── Passada 1: o que está faltando? ────────────────────────────────────
  await escriturarPendentes(db, companyId);
  const dados = await coletarDadosDoMes(db, companyId, referenceMonth);
  const antes = verificarFechamento(dados);

  // ── Resolver ───────────────────────────────────────────────────────────
  for (const o of antes.resolverSozinha) {
    try {
      if (o.id === 'sem_classificacao') {
        const r = await classificarPendentes(companyId, { limite: 60, userId: opts.userId });
        if (!r.disponivel) {
          resolvido.push({
            pendencia: o.id,
            acao: 'IA desligada — classificação não pôde ser feita.',
          });
        } else {
          resolvido.push({
            pendencia: o.id,
            acao:
              `${r.aplicados} lançamento(s) classificado(s) automaticamente` +
              (r.aguardandoAprovacao ? `, ${r.aguardandoAprovacao} aguardando aprovação` : '') +
              (r.descartados.length ? `, ${r.descartados.length} sem confiança suficiente` : '') +
              '.',
          });
        }
      } else if (o.id === 'guia_nao_provisionada') {
        const feito = await provisionarGuia(companyId, referenceMonth, dados.receita);
        if (feito) resolvido.push(feito);
      }
      // `extrato_nao_conciliado` fica para quando houver Open Finance: sem
      // extrato entrando, não há o que conciliar, e fingir que resolveu seria
      // pior que deixar como pendência honesta.
    } catch (err) {
      resolvido.push({
        pendencia: o.id,
        acao: `Falhou: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Classificação mexe em conta contábil, então o resultado precisa ser
  // reapurado antes da segunda conferência — senão o balanço da conferência
  // final ainda refletiria as contas antigas.
  if (resolvido.some((r) => r.pendencia === 'sem_classificacao')) {
    await reapurarResultado(db, companyId, referenceMonth, 'reclassificação no fechamento');
  }

  // ── Passada 2: a conferência que vale ──────────────────────────────────
  const fechamento = await fecharMesComConferencia(db, companyId, referenceMonth, opts);

  const aindaPrecisaDoCliente = fechamento.precisaDoCliente
    .filter((o) => o.severidade === 'BLOQUEIO')
    .map((o) => ({ id: o.id, mensagem: o.mensagemCliente! }));

  // ── A IA tranca o mês ──────────────────────────────────────────────────
  //
  // Sem pedir nada a ninguém: trancar é reversível e não sai do sistema. O
  // contador confere DEPOIS, e é a conferência dele que libera para o
  // contábil. Esperar aprovação aqui deixaria o cliente sem saber se pode
  // continuar lançando naquele mês.
  const finais = await coletarDadosDoMes(db, companyId, referenceMonth);
  const trava = await fecharParaOCliente(
    db,
    companyId,
    referenceMonth,
    {
      podeFechar: fechamento.podeFechar,
      resumo: fechamento.resumo,
      ocorrencias: fechamento.ocorrencias,
      resolvidoPelaIA: resolvido,
      pedidosAoCliente: aindaPrecisaDoCliente,
    },
    fechamento.agentRunId,
    { receita: finais.receita, despesa: finais.despesaTotal },
  );

  return {
    ...fechamento,
    resolvido,
    aindaPrecisaDoCliente,
    trancado: trava.fechado,
    motivoNaoTrancou: trava.motivo,
  };
}
