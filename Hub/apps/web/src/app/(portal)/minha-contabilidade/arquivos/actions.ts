'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and } from '@hexxa/db';
import { companyDocument } from '@hexxa/db/schema';
import { CATEGORIAS, type Categoria } from '@/lib/documentos-categorias';

export type SaveDocState = { ok: boolean; message: string };

/** Guarda um documento da empresa, com o arquivo (até 3 MB, PDF ou imagem). */
export async function createDocumentAction(input: {
  category: Categoria;
  name: string;
  issuedAt: string;
  expiresAt: string;
  arquivo: { dataUrl: string; nome: string } | null;
}): Promise<SaveDocState> {
  const ctx = await getTenantContext();
  if (!(input.category in CATEGORIAS)) return { ok: false, message: 'Categoria inválida.' };
  if (!input.name.trim()) return { ok: false, message: 'Dê um nome ao documento.' };
  if (input.arquivo && !/^data:(application\/pdf|image\/(png|jpe?g|webp));base64,/.test(input.arquivo.dataUrl)) {
    return { ok: false, message: 'O arquivo precisa ser PDF ou imagem.' };
  }
  if (input.expiresAt && input.issuedAt && input.expiresAt < input.issuedAt) {
    return { ok: false, message: 'A validade precisa ser depois da emissão.' };
  }
  await withTenant(ctx.companyId, (tx) =>
    tx.insert(companyDocument).values({
      companyId: ctx.companyId,
      category: input.category,
      name: input.name.trim(),
      issuedAt: input.issuedAt || null,
      expiresAt: input.expiresAt || null,
      fileData: input.arquivo?.dataUrl ?? null,
      fileName: input.arquivo?.nome ?? null,
    }),
  );
  revalidatePath('/minha-contabilidade/arquivos');
  return { ok: true, message: 'Documento guardado.' };
}

export async function deleteDocumentAction(id: string): Promise<SaveDocState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, (tx) =>
    tx.delete(companyDocument).where(and(eq(companyDocument.id, id), eq(companyDocument.companyId, ctx.companyId))),
  );
  revalidatePath('/minha-contabilidade/arquivos');
  return { ok: true, message: 'Documento removido.' };
}
