import 'server-only';
import { getDb, sql } from '@hexxa/db';
import type { ModuloDoPlano } from '@/lib/plano-acesso';

/**
 * O que o plano da empresa permite: módulos fora e limites do mês.
 *
 * Sem assinatura ou sem limites no plano = acesso completo. O limite de notas
 * pode ser liberado pelo contador para um mês (`company.notas_extras_mes`).
 */
export interface AcessoDoPlano {
  plano: string | null;
  bloqueados: ModuloDoPlano[];
  limiteNotasMes: number | null;
  limiteFaturamentoMes: number | null;
  /** Mês ('AAAA-MM') em que o contador liberou notas além do limite. */
  notasLiberadasNoMes: string | null;
}

export async function acessoDoPlano(companyId: string): Promise<AcessoDoPlano> {
  const [r] = (await getDb()
    .execute(sql`
      SELECT p.features, c.notas_extras_mes
        FROM company c
        LEFT JOIN subscription s ON s.company_id = c.id AND s.status <> 'CANCELED'
        LEFT JOIN plan p ON p.id = s.plan_id
       WHERE c.id = ${companyId}
       LIMIT 1
    `)
    .catch(() => [])) as unknown as {
    features: { nomeComercial?: string; modulosBloqueados?: ModuloDoPlano[]; limiteNotasMes?: number; limiteFaturamentoMes?: number } | null;
    notas_extras_mes: string | null;
  }[];
  const f = r?.features ?? null;
  return {
    plano: f?.nomeComercial ?? null,
    bloqueados: Array.isArray(f?.modulosBloqueados) ? f!.modulosBloqueados! : [],
    limiteNotasMes: typeof f?.limiteNotasMes === 'number' ? f.limiteNotasMes : null,
    limiteFaturamentoMes: typeof f?.limiteFaturamentoMes === 'number' ? f.limiteFaturamentoMes : null,
    notasLiberadasNoMes: r?.notas_extras_mes ?? null,
  };
}

/** Notas emitidas pela empresa no mês ('AAAA-MM'): as da Hexx e as do Emissor Nacional. */
export async function notasEmitidasNoMes(companyId: string, mes: string): Promise<number> {
  const [r] = (await getDb().execute(sql`
    SELECT (
      (SELECT count(*) FROM service_invoice
        WHERE company_id = ${companyId} AND status IN ('ISSUED', 'ISSUING')
          AND to_char(reference_month, 'YYYY-MM') = ${mes})
      +
      (SELECT count(*) FROM nfse_distribuicao_doc d
        WHERE d.company_id = ${companyId} AND d.direction = 'EMITIDA' AND NOT coalesce(d.cancelado, false)
          AND to_char(d.data_emissao, 'YYYY-MM') = ${mes}
          -- a mesma nota emitida pela Hexx volta pelo ADN: não conta duas vezes
          AND NOT EXISTS (SELECT 1 FROM service_invoice si WHERE si.company_id = d.company_id AND si.provider_protocol = d.chave_acesso))
    )::int AS n
  `)) as unknown as { n: number }[];
  return r?.n ?? 0;
}
