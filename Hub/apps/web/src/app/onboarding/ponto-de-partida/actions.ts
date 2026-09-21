'use server';

import { getDb, sql, withTenant, abrirSaldos } from '@hexxa/db';
import { ACCOUNTS } from '@hexxa/core';
import { getTenantContext } from '@/lib/server/tenant';
import { revalidatePath } from 'next/cache';

const ACCOUNTS_DE_ABERTURA = {
  BANCOS: ACCOUNTS.BANCOS,
  LUCROS_ACUMULADOS: ACCOUNTS.LUCROS_ACUMULADOS,
};

/**
 * O PONTO DE PARTIDA, EM DOIS NÚMEROS.
 *
 * ── Por que não um balancete ───────────────────────────────────────────
 *
 * `abrirSaldos` aceita um balancete inteiro, e é o caminho certo quando ele
 * existe — o contador já tem essa tela. Mas quem está abrindo o Hub sozinho,
 * cinco minutos depois de pagar, não tem balancete à mão; pedir um é o mesmo
 * que dizer "volte quando falar com seu contador". A pessoa não volta.
 *
 * Dois números ela sabe de cabeça: quanto tem na conta hoje e quanto faturou
 * no último ano. E os dois bastam para ligar o essencial — o saldo livre, o
 * termômetro de imposto, a previsão de caixa e o teto do Simples.
 *
 * ── Por que o saldo vira Lucros Acumulados ─────────────────────────────
 *
 * Toda partida precisa de contrapartida. O dinheiro que já estava na conta
 * antes de o Hub existir veio do resultado passado da empresa — não de
 * integralização de capital nova, que seria afirmar um ato societário que não
 * aconteceu. Lucros Acumulados é a conta honesta para "veio de antes", e o
 * contador reclassifica depois se for o caso.
 */
export type EstadoDoPontoDePartida = { ok: boolean; message: string };

export async function salvarPontoDePartida(
  _prev: EstadoDoPontoDePartida,
  formData: FormData,
): Promise<EstadoDoPontoDePartida> {
  const ctx = await getTenantContext();

  const numero = (v: FormDataEntryValue | null) => {
    const texto = String(v ?? '').replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const n = Number(texto);
    return Number.isFinite(n) ? n : NaN;
  };

  const saldo = numero(formData.get('saldo'));
  const faturamento = numero(formData.get('faturamento'));
  const data = String(formData.get('data') ?? '').trim();

  if (!Number.isFinite(saldo)) {
    return { ok: false, message: 'Informe quanto há hoje na conta da empresa.' };
  }
  if (!Number.isFinite(faturamento) || faturamento < 0) {
    return { ok: false, message: 'Informe quanto a empresa faturou nos últimos 12 meses.' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return { ok: false, message: 'Informe a data do saldo.' };
  }

  try {
    await withTenant(ctx.companyId, async (tx) => {
      /**
       * Saldo zero também é resposta.
       *
       * Empresa recém-aberta tem conta zerada, e isso é informação: sem a
       * partida de abertura, o Hub não sabe se o saldo é zero ou se ninguém
       * contou — e é essa diferença que faz o card do caixa livre falar ou
       * se calar. Por isso grava-se a abertura mesmo com zero.
       */
      await abrirSaldos(
        tx,
        ctx.companyId,
        data,
        [
          { conta: ACCOUNTS.BANCOS, saldo },
          { conta: ACCOUNTS.LUCROS_ACUMULADOS, saldo },
        ],
        'Ponto de partida informado no primeiro acesso',
      );

      // O faturamento declarado é referência, não lançamento: ele não tem
      // nota, e receita sem nota nunca vira partida no razão. Fica no
      // cadastro para o termômetro ter de onde partir enquanto não há
      // histórico próprio.
      await tx.execute(sql`
        UPDATE company
           SET declared_revenue_12m = ${faturamento}, declared_revenue_at = ${data}::date
         WHERE id = ${ctx.companyId}
      `);
    });
  } catch (err) {
    console.error('[ponto-de-partida] falhou:', err);
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Não consegui gravar o ponto de partida.',
    };
  }

  revalidatePath('/cliente');
  return { ok: true, message: 'Pronto. Seu Hub já está funcionando.' };
}

/** O que já foi informado, para a tela não pedir de novo o que existe. */
export async function lerPontoDePartida(): Promise<{ saldo: number | null; faturamento: number | null }> {
  const ctx = await getTenantContext();
  const db = getDb();
  const [r] = (await db.execute(sql`
    SELECT
      (SELECT COALESCE(SUM(CASE WHEN l.direction = 'DEBIT' THEN l.amount ELSE -l.amount END), 0)
         FROM ledger_line l
         JOIN journal_entry j ON j.id = l.journal_entry_id
         JOIN chart_of_account a ON a.id = l.account_id
        WHERE l.company_id = ${ctx.companyId} AND j.source = 'OPENING'
          AND a.code = ${'1.1.01.002'}) AS saldo,
      (SELECT declared_revenue_12m FROM company WHERE id = ${ctx.companyId}) AS faturamento
  `)) as unknown as { saldo: string | null; faturamento: string | null }[];

  return {
    saldo: r?.saldo === null || r?.saldo === undefined ? null : Number(r.saldo),
    faturamento: r?.faturamento === null || r?.faturamento === undefined ? null : Number(r.faturamento),
  };
}

export type EstadoDaLeituraPgdas = {
  ok: boolean;
  message: string;
  faturamento: number | null;
};

/**
 * O extrato do PGDAS preenche o faturamento.
 *
 * O número que este passo pede — receita dos últimos 12 meses — é o RBT12 que
 * a própria Receita calculou e imprimiu no extrato. Deixar a pessoa digitar de
 * cabeça convida a um arredondamento que muda a faixa do Simples.
 *
 * Ler também GRAVA a apuração em `tax_history`, e isso importa mais do que
 * parece: é daí que sai o anexo apurado, que decide se o card do Fator R pode
 * ou não sugerir aumento de pró-labore.
 */
export async function lerPgdasEnviado(
  _prev: EstadoDaLeituraPgdas,
  formData: FormData,
): Promise<EstadoDaLeituraPgdas> {
  const ctx = await getTenantContext();
  const arquivo = formData.get('pgdas');

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, message: 'Escolha o PDF do extrato.', faturamento: null };
  }

  let texto: string;
  try {
    // require() só aqui dentro: o pdf-parse referencia DOMMatrix na cadeia de
    // import e um require de topo derruba o build do Next.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse');
    texto = (await pdfParse(Buffer.from(await arquivo.arrayBuffer()))).text;
  } catch (err) {
    console.error('[ponto-de-partida/pgdas] falha ao abrir o PDF:', err);
    return { ok: false, message: 'Não consegui abrir esse PDF.', faturamento: null };
  }

  const { lerExtratoPgdas } = await import('@hexxa/core');
  const leitura = lerExtratoPgdas(texto);
  if (!leitura.ok || !leitura.extrato) {
    return { ok: false, message: leitura.motivo ?? 'Não consegui ler o extrato.', faturamento: null };
  }

  const e = leitura.extrato;
  if (e.competencia && e.aliquotaEfetiva !== null) {
    // A apuração oficial vale mais que qualquer estimativa nossa — e é ela
    // que diz o anexo. Ver `enquadramentoApurado`.
    await getDb()
      .execute(sql`
        INSERT INTO tax_history (company_id, reference_month, rba12, effective_rate, tax_bracket, source)
        VALUES (${ctx.companyId}, ${`${e.competencia}-01`}::date, ${e.rbt12}, ${e.aliquotaEfetiva},
                ${e.anexo ?? 'Anexo III'}, 'PGDAS')
        ON CONFLICT (company_id, reference_month) DO UPDATE
           SET rba12 = EXCLUDED.rba12, effective_rate = EXCLUDED.effective_rate,
               tax_bracket = EXCLUDED.tax_bracket
      `)
      .catch((err) => console.error('[ponto-de-partida/pgdas] tax_history:', err));
  }

  const quando = e.competencia
    ? new Date(`${e.competencia}-01T12:00:00Z`).toLocaleDateString('pt-BR', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return {
    ok: true,
    message: quando
      ? `Extrato de ${quando} lido${e.anexo ? ` — ${e.anexo}` : ''}. Confira o valor abaixo.`
      : 'Extrato lido. Confira o valor abaixo.',
    faturamento: e.rbt12,
  };
}
