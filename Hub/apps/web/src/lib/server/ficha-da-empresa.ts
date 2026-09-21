import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * A FICHA DA EMPRESA — o que o empresário reconhece como "a minha empresa".
 *
 * ── Por que não é só o cadastro ────────────────────────────────────────
 *
 * Razão social, CNPJ e endereço ele já sabe de cor; uma tela que só repete
 * isso não vale o clique. O que ele não tem em lugar nenhum é a soma: há
 * quanto tempo a empresa existe, quantas notas já emitiu este ano, quanto
 * faturou, quem são os sócios e com que participação.
 *
 * Por isso a ficha junta cadastro (o que a Receita diz) com movimento (o que
 * o Hub viu acontecer). É a diferença entre um formulário e um retrato.
 */

export interface Socio {
  nome: string;
  cpf: string | null;
  participacao: number;
  proLabore: number;
}

export interface FichaDaEmpresa {
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regime: string | null;
  situacao: 'ATIVA' | 'ENCERRADA';
  abertura: string | null;
  /** Em meses, desde a abertura. `null` quando não se sabe a data. */
  tempoDeAtividade: number | null;
  capitalSocial: number | null;
  capitalAIntegralizar: number;
  atividadeCodigo: string | null;
  atividadeTexto: string | null;
  endereco: string | null;
  socios: Socio[];
  /** Notas emitidas no ano corrente. */
  notasNoAno: number;
  faturamentoNoAno: number;
  /** Ano usado nos dois números acima. */
  ano: number;
}

export async function getFichaDaEmpresa(ctx: TenantContext): Promise<FichaDaEmpresa | null> {
  const ano = Number(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 4),
  );

  return withTenant(ctx.companyId, async (tx) => {
    const [empresa] = (await tx.execute(sql`
      SELECT
        legal_name, trade_name, cnpj, tax_regime::text AS regime, closed_at,
        to_char(founded_at, 'YYYY-MM-DD') AS abertura,
        share_capital, unpaid_share_capital,
        main_activity_code, main_activity_text,
        address_line1, address_number, neighborhood, city, state, zipcode
      FROM company WHERE id = ${ctx.companyId}
    `)) as unknown as Record<string, string | null>[];

    if (!empresa) return null;

    const socios = (await tx.execute(sql`
      SELECT name, cpf, ownership_pct, pro_labore
        FROM partner WHERE company_id = ${ctx.companyId}
       ORDER BY ownership_pct DESC, name
    `)) as unknown as { name: string; cpf: string | null; ownership_pct: string; pro_labore: string }[];

    /**
     * Notas e faturamento do ano: só o que virou NOTA.
     *
     * A mesma regra que vale para o imposto vale para o retrato — ver a regra
     * da receita. Somar boleto ou entrada de extrato aqui daria um número
     * maior que o da apuração, e o empresário compararia as duas telas.
     */
    const [movimento] = (await tx.execute(sql`
      SELECT
        count(*)::int AS notas,
        COALESCE(SUM(amount), 0) AS total
      FROM service_invoice
      WHERE company_id = ${ctx.companyId}
        AND status <> 'CANCELED'
        AND reference_month >= ${`${ano}-01-01`}::date
        AND reference_month <= ${`${ano}-12-01`}::date
    `)) as unknown as { notas: number; total: string }[];

    const abertura = empresa.abertura ?? null;
    const tempoDeAtividade = abertura
      ? Math.max(
          0,
          Math.floor((Date.now() - Date.parse(`${abertura}T12:00:00Z`)) / (30.44 * 86400000)),
        )
      : null;

    const endereco =
      [
        empresa.address_line1,
        empresa.address_number,
        empresa.neighborhood,
        empresa.city,
        empresa.state,
      ]
        .filter(Boolean)
        .join(', ') || null;

    return {
      razaoSocial: String(empresa.legal_name ?? ''),
      nomeFantasia: empresa.trade_name ?? null,
      cnpj: String(empresa.cnpj ?? ''),
      regime: empresa.regime ?? null,
      situacao: empresa.closed_at ? 'ENCERRADA' : 'ATIVA',
      abertura,
      tempoDeAtividade,
      capitalSocial: empresa.share_capital == null ? null : Number(empresa.share_capital),
      capitalAIntegralizar: Number(empresa.unpaid_share_capital ?? 0),
      atividadeCodigo: empresa.main_activity_code ?? null,
      atividadeTexto: empresa.main_activity_text ?? null,
      endereco,
      socios: socios.map((s) => ({
        nome: s.name,
        cpf: s.cpf,
        participacao: Number(s.ownership_pct),
        proLabore: Number(s.pro_labore),
      })),
      notasNoAno: Number(movimento?.notas ?? 0),
      faturamentoNoAno: Number(movimento?.total ?? 0),
      ano,
    };
  });
}
