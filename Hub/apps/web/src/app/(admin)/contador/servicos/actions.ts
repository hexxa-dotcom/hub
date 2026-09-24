'use server';

import { revalidatePath } from 'next/cache';
import { getDb, sql } from '@hexxa/db';
import { requireAdmin } from '@/lib/server/admin-guard';
import type { TipoDePreco } from '@/lib/servicos-preco';

/** Salva o preço e se o serviço aparece no catálogo dos clientes. */
export async function salvarServicoAction(id: string, input: { precoTipo: TipoDePreco; preco: number | null; ativo: boolean }) {
  await requireAdmin();
  if (!['INCLUSO', 'A_PARTIR', 'FIXO', 'ORCAMENTO'].includes(input.precoTipo)) return { ok: false, message: 'Tipo de preço inválido.' };
  const precisaValor = input.precoTipo === 'A_PARTIR' || input.precoTipo === 'FIXO';
  if (precisaValor && !(input.preco && input.preco > 0)) return { ok: false, message: 'Informe o valor.' };
  await getDb().execute(sql`
    UPDATE service_catalog
       SET preco_tipo = ${input.precoTipo}, preco = ${precisaValor ? input.preco : null}, ativo = ${input.ativo}
     WHERE id = ${id}::uuid
  `);
  revalidatePath('/contador/servicos');
  revalidatePath('/mais/servicos');
  return { ok: true, message: 'Salvo.' };
}
