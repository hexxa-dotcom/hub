'use server';

import { getDb, filaDoEscritorio, sql } from '@hexxa/db';
import type { ItemDaFilaDoEscritorio } from '@hexxa/db';
import { requireAdmin, adminUserId } from '@/lib/server/admin-guard';
import { decidirAcao } from '@/lib/server/agent-tools';
import { revalidatePath } from 'next/cache';

/**
 * Fila do escritório — tudo o que a IA fez ou quer fazer, de todos os clientes.
 *
 * Decidir aqui tem efeito no razão: rejeitar uma classificação exige a
 * categoria certa e reclassifica por estorno. Ver `decidirAcao`.
 */

export interface CategoriaDaEmpresa {
  id: string;
  companyId: string;
  nome: string;
  tipo: string;
}

export async function carregarFila(): Promise<{
  itens: ItemDaFilaDoEscritorio[];
  categorias: CategoriaDaEmpresa[];
}> {
  await requireAdmin();
  const db = getDb();
  const itens = await filaDoEscritorio(db);

  const empresas = [...new Set(itens.map((i) => i.companyId))];
  const categorias = empresas.length
    ? ((await db.execute(sql`
        SELECT id::text, company_id::text, name, kind::text
          FROM category
         WHERE company_id = ANY(${`{${empresas.join(',')}}`}::uuid[])
         ORDER BY name
      `)) as unknown as { id: string; company_id: string; name: string; kind: string }[])
    : [];

  return {
    itens,
    categorias: categorias.map((c) => ({ id: c.id, companyId: c.company_id, nome: c.name, tipo: c.kind })),
  };
}

export async function decidirNaFila(
  companyId: string,
  acaoId: string,
  decisao: 'certo' | 'errado',
  nota?: string,
  categoriaCorretaId?: string,
): Promise<{ ok: boolean; mensagem: string }> {
  await requireAdmin();
  const userId = await adminUserId();
  const r = await decidirAcao(
    companyId,
    acaoId,
    decisao === 'certo' ? 'APPROVED' : 'REJECTED',
    userId,
    nota,
    categoriaCorretaId,
  );
  revalidatePath('/contador/revisao');
  return { ok: r.ok, mensagem: r.mensagem };
}

/**
 * Confirma um grupo inteiro — "estes lançamentos foram para esta categoria, e
 * está certo".
 *
 * Não é aprovar às cegas: o grupo é mostrado inteiro antes, lançamento por
 * lançamento. O que evita é clicar 107 vezes num botão para confirmar o que
 * se confere numa olhada.
 */
export async function confirmarGrupo(
  itens: { companyId: string; acaoId: string }[],
): Promise<{ ok: boolean; confirmados: number; falhas: number }> {
  await requireAdmin();
  const userId = await adminUserId();
  let confirmados = 0;
  let falhas = 0;
  for (const i of itens) {
    const r = await decidirAcao(i.companyId, i.acaoId, 'APPROVED', userId);
    if (r.ok) confirmados++;
    else falhas++;
  }
  revalidatePath('/contador/revisao');
  return { ok: falhas === 0, confirmados, falhas };
}
