import { NextResponse } from 'next/server';
import { getDb, withDbTimeout, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { syncDistribuicaoDfe } from '@/lib/server/nfse-dfe-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Para antes do timeout: a empresa em andamento termina, a próxima fica para amanhã. */
const PARAR_EM_MS = 240_000;

/**
 * NOTAS DO EMISSOR NACIONAL — O FATURAMENTO QUE CHEGA SOZINHO.
 *
 * ── Por que existe ──────────────────────────────────────────────────────
 *
 * Até a emissão pelo Hub ser liberada para o Simples, as notas saem por
 * outros sistemas (Nibo, prefeitura). Todas acabam no Ambiente de Dados
 * Nacional, e é de lá — a fonte, não um intermediário — que o Hub lê o
 * faturamento. A leitura já existia, mas só rodava quando alguém apertava
 * "sincronizar" na tela de notas: sem o clique, o faturamento não aparecia.
 *
 * Roda para toda empresa com certificado A1 cadastrado. É incremental pelo
 * NSU: cada execução busca só o que chegou depois da anterior, e a primeira
 * traz todo o histórico que o ADN guarda.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const inicio = Date.now();
  const db = getDb();

  try {
    const empresas = (await withDbTimeout(
      db.execute(sql`
        SELECT c.id, c.type
          FROM nfse_config n
          JOIN company c ON c.id = n.company_id
         WHERE n.cert_pfx_b64 IS NOT NULL
           AND n.cnpj IS NOT NULL
           -- O cadastro fiscal tem de ser da própria empresa. Um CNPJ de outra
           -- pessoa ali traria as notas dela como faturamento desta.
           AND regexp_replace(n.cnpj, '[^0-9]', '', 'g') = regexp_replace(c.cnpj, '[^0-9]', '', 'g')
           AND c.closed_at IS NULL
         ORDER BY n.ult_nsu_distribuicao ASC
      `),
      8000,
    )) as unknown as { id: string; type: string }[];

    const resultados: { companyId: string; notasNovas: number; eventosNovos: number; erro?: string }[] = [];
    let adiadas = 0;

    for (const empresa of empresas) {
      if (Date.now() - inicio > PARAR_EM_MS) {
        adiadas++;
        continue;
      }
      const ctx: TenantContext = {
        companyId: empresa.id,
        companyType: empresa.type as TenantContext['companyType'],
        userId: 'cron',
      };
      try {
        const r = await syncDistribuicaoDfe(ctx);
        resultados.push({ companyId: empresa.id, notasNovas: r.documentosNovos, eventosNovos: r.eventosNovos, erro: r.erro });
      } catch (err: any) {
        resultados.push({ companyId: empresa.id, notasNovas: 0, eventosNovos: 0, erro: err.message });
      }
    }

    const notas = resultados.reduce((s, r) => s + r.notasNovas, 0);
    const erros = resultados.filter((r) => r.erro);
    return NextResponse.json({
      message: `Emissor Nacional: ${notas} documento(s) novo(s) em ${resultados.length} empresa(s)${adiadas ? `, ${adiadas} adiada(s) pelo relógio` : ''}.`,
      errors: erros.length > 0 ? erros : undefined,
    });
  } catch (error: any) {
    console.error('Erro no Cron do Emissor Nacional:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
