import 'server-only';
import { getDb, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { emitirNota, LIBERA_SIMPLES } from './emissao';

/**
 * EMISSÃO AGENDADA — a nota que sai sozinha.
 *
 * Para quem não tem contrato: "todo dia 5 para o Cliente X" ou "uma nota no
 * dia 20". A rotina da manhã emite o que vence hoje pelo mesmo caminho de
 * toda emissão (`emitirNota` — travas, CNPJ, e-mail), avisa na véspera o que
 * sai amanhã e empurra a próxima data um mês para frente.
 *
 * Uma nota igual já emitida no mês não é duplicada: a agendada respeita a
 * mesma trava da manual e registra o motivo em vez de emitir.
 */

export interface EmissaoAgendada {
  id: string;
  customerId: string;
  cliente: string;
  descricao: string;
  valor: number;
  proximaData: string;
  diaDoMes: number | null;
  ate: string | null;
  ativa: boolean;
  ultimoErro: string | null;
}

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const somaDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
/** Mesmo dia no mês seguinte (o dia é limitado a 28 para existir em todo mês). */
const proximoMes = (iso: string, dia: number) => {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m, dia, 12));
  return d.toISOString().slice(0, 10);
};

export async function listarAgendadas(companyId: string): Promise<EmissaoAgendada[]> {
  return (await getDb().execute(sql`
    SELECT a.id::text, a.customer_id::text AS "customerId", c.name AS cliente, a.descricao, a.valor::float,
           to_char(a.proxima_data, 'YYYY-MM-DD') AS "proximaData", a.dia_do_mes AS "diaDoMes",
           to_char(a.ate, 'YYYY-MM-DD') AS ate, a.ativa, a.ultimo_erro AS "ultimoErro"
      FROM emissao_agendada a JOIN customer c ON c.id = a.customer_id
     WHERE a.company_id = ${companyId}
     ORDER BY a.ativa DESC, a.proxima_data
  `)) as unknown as EmissaoAgendada[];
}

export async function agendar(
  companyId: string,
  p: { customerId: string; perfilId?: string; descricao: string; valor: number; data: string; repetir: boolean; ate?: string; enviarEmail?: boolean },
): Promise<{ ok: boolean; mensagem: string }> {
  if (!(p.valor > 0)) return { ok: false, mensagem: 'Informe um valor maior que zero.' };
  if (!p.descricao.trim()) return { ok: false, mensagem: 'Descreva o serviço.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data) || p.data < hojeSP()) return { ok: false, mensagem: 'Escolha uma data de hoje em diante.' };
  const [reg] = (await getDb().execute(sql`SELECT tax_regime FROM company WHERE id = ${companyId}`)) as unknown as { tax_regime: string | null }[];
  if (reg?.tax_regime === 'SIMPLES_NACIONAL' && p.data < LIBERA_SIMPLES) {
    return { ok: false, mensagem: 'Para o Simples, a emissão pela Hexx começa em 1º de novembro — escolha uma data a partir daí.' };
  }
  const dia = Math.min(28, Number(p.data.slice(8, 10)));
  await getDb().execute(sql`
    INSERT INTO emissao_agendada (company_id, customer_id, perfil_id, descricao, valor, proxima_data, dia_do_mes, ate, enviar_email)
    VALUES (${companyId}, ${p.customerId}, ${p.perfilId || null}, ${p.descricao.trim()}, ${p.valor.toFixed(2)}, ${p.data}::date,
            ${p.repetir ? dia : null}, ${p.ate || null}, ${p.enviarEmail !== false})
  `);
  const quando = p.data.split('-').reverse().join('/');
  return { ok: true, mensagem: p.repetir ? `Agendada: todo dia ${dia}, começando em ${quando}.` : `Agendada para ${quando}.` };
}

export async function alterarAgendada(companyId: string, id: string, acao: 'pausar' | 'retomar' | 'pular' | 'excluir'): Promise<void> {
  const db = getDb();
  if (acao === 'excluir') {
    await db.execute(sql`DELETE FROM emissao_agendada WHERE id = ${id} AND company_id = ${companyId}`);
  } else if (acao === 'pular') {
    // Pula a próxima: só faz sentido na que repete; a única é desativada.
    await db.execute(sql`
      UPDATE emissao_agendada
         SET proxima_data = CASE WHEN dia_do_mes IS NULL THEN proxima_data
                                 ELSE (date_trunc('month', proxima_data) + interval '1 month' + (dia_do_mes - 1) * interval '1 day')::date END,
             ativa = dia_do_mes IS NOT NULL
       WHERE id = ${id} AND company_id = ${companyId}
    `);
  } else {
    await db.execute(sql`UPDATE emissao_agendada SET ativa = ${acao === 'retomar'} WHERE id = ${id} AND company_id = ${companyId}`);
  }
}

/** A rotina diária: emite o que vence hoje (ou ficou para trás) e avisa o que sai amanhã. */
export async function rodarAgendadas(): Promise<{ emitidas: number; erros: string[]; avisos: number }> {
  const db = getDb();
  const hoje = hojeSP();
  const amanha = somaDias(hoje, 1);
  const out = { emitidas: 0, erros: [] as string[], avisos: 0 };

  const devidas = (await db.execute(sql`
    SELECT a.id::text, a.company_id::text AS "companyId", a.customer_id::text AS "customerId", a.perfil_id::text AS "perfilId",
           a.descricao, a.valor::float, to_char(a.proxima_data, 'YYYY-MM-DD') AS "proximaData", a.dia_do_mes AS "diaDoMes",
           to_char(a.ate, 'YYYY-MM-DD') AS ate, a.enviar_email AS "enviarEmail", co.type AS "companyType"
      FROM emissao_agendada a JOIN company co ON co.id = a.company_id
     WHERE a.ativa AND a.proxima_data <= ${hoje}::date AND co.closed_at IS NULL
  `)) as unknown as {
    id: string; companyId: string; customerId: string; perfilId: string | null; descricao: string; valor: number;
    proximaData: string; diaDoMes: number | null; ate: string | null; enviarEmail: boolean; companyType: string;
  }[];

  for (const a of devidas) {
    const ctx = { companyId: a.companyId, companyType: a.companyType, userId: 'agendamento' } as TenantContext;
    let erro: string | null = null;
    let notaId: string | null = null;
    try {
      const r = await emitirNota(ctx, {
        customerId: a.customerId,
        valor: a.valor,
        descricao: a.descricao,
        perfilId: a.perfilId ?? undefined,
        competencia: hoje,
        enviarEmail: a.enviarEmail,
      });
      if (r.ok) {
        out.emitidas++;
        notaId = r.invoiceId ?? null;
      } else {
        erro = r.message;
      }
    } catch (err) {
      erro = err instanceof Error ? err.message : String(err);
    }
    if (erro) out.erros.push(`${a.id}: ${erro}`);

    // Anda a data mesmo com erro: a mesma nota não fica tentando todo dia —
    // o erro fica registrado e aparece na lista para alguém resolver.
    const proxima = a.diaDoMes ? proximoMes(a.proximaData, a.diaDoMes) : null;
    const continua = !!proxima && (!a.ate || proxima <= a.ate);
    await db.execute(sql`
      UPDATE emissao_agendada
         SET proxima_data = ${proxima ?? a.proximaData}::date, ativa = ${continua},
             ultima_nota_id = coalesce(${notaId}::uuid, ultima_nota_id), ultimo_erro = ${erro}
       WHERE id = ${a.id}
    `);
  }

  // Aviso de véspera: o sino do cliente, uma vez por agendamento e data.
  const vespera = (await db.execute(sql`
    SELECT a.id::text, a.company_id::text AS "companyId", c.name AS cliente, a.valor::float
      FROM emissao_agendada a JOIN customer c ON c.id = a.customer_id
     WHERE a.ativa AND a.proxima_data = ${amanha}::date AND (a.avisada_em IS NULL OR a.avisada_em < ${hoje}::date)
  `)) as unknown as { id: string; companyId: string; cliente: string; valor: number }[];
  for (const v of vespera) {
    const valor = v.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    await db.execute(sql`
      INSERT INTO notification (company_id, severity, title, body)
      VALUES (${v.companyId}, 'INFO', 'Nota agendada para amanhã',
              ${`Amanhã sai a nota de ${valor} para ${v.cliente}. Para mudar, pause ou pule em Notas > Agendadas.`})
    `);
    await db.execute(sql`UPDATE emissao_agendada SET avisada_em = ${hoje}::date WHERE id = ${v.id}`);
    out.avisos++;
  }
  return out;
}

// ── Pendentes: parcela de contrato sem nota ─────────────────────────────────

export interface NotaPendente {
  parcelaId: string;
  contrato: string;
  cliente: string;
  documento: string | null;
  email: string | null;
  valor: number;
  vencimento: string;
  descricao: string;
  atrasada: boolean;
}

/**
 * Parcelas de contrato de cliente que vencem (ou venceram há até 60 dias) e
 * ainda não têm nota — nem emitida daqui (a nota assume a parcela, ver
 * `emitirNota`), nem no Emissor Nacional para o mesmo CNPJ no mês.
 */
export async function notasPendentes(companyId: string): Promise<NotaPendente[]> {
  const hoje = hojeSP();
  return (await getDb().execute(sql`
    SELECT fe.id::text AS "parcelaId", bc.title AS contrato, coalesce(nullif(bc.party_name, ''), bc.title) AS cliente,
           bc.party_cnpj AS documento, bc.party_email AS email, fe.amount::float AS valor,
           to_char(fe.due_date, 'YYYY-MM-DD') AS vencimento,
           coalesce(nullif(bc.description, ''), bc.title) AS descricao,
           fe.due_date < ${hoje}::date AS atrasada
      FROM financial_entry fe
      JOIN business_contract bc ON bc.id = fe.source_id AND bc.company_id = fe.company_id
     WHERE fe.company_id = ${companyId} AND fe.source = 'CONTRACT' AND fe.type = 'RECEIVABLE'
       AND fe.status <> 'CANCELED' AND bc.type = 'ENTRADA'
       AND fe.due_date BETWEEN (${hoje}::date - 60) AND (${hoje}::date + 7)
       AND NOT EXISTS (
         SELECT 1 FROM nfse_distribuicao_doc d
          WHERE d.company_id = fe.company_id AND d.tipo_documento = 'NFSE' AND d.direction = 'EMITIDA' AND NOT d.cancelado
            AND bc.party_cnpj IS NOT NULL
            AND regexp_replace(coalesce(d.tomador_documento, ''), '[^0-9]', '', 'g') = regexp_replace(bc.party_cnpj, '[^0-9]', '', 'g')
            AND to_char(d.data_emissao AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM') = to_char(fe.reference_month, 'YYYY-MM'))
     ORDER BY fe.due_date
  `)) as unknown as NotaPendente[];
}
