'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { withTenant, eq, and, desc } from '@hexxa/db';
import { companyDocument } from '@hexxa/db/schema';

export type DocRow = {
  id: string;
  category: 'ALVARA' | 'CONTRATO' | 'CND' | 'OUTRO';
  name: string;
  issuedAt: string | null;
  expiresAt: string | null;
  fileUrl: string | null;
};

export async function listDocumentsAction(): Promise<DocRow[]> {
  const ctx = await getTenantContext();
  const rows = await withTenant(ctx.companyId, async (tx) => {
    return tx.select().from(companyDocument).where(eq(companyDocument.companyId, ctx.companyId)).orderBy(desc(companyDocument.createdAt));
  });
  return rows.map((r) => ({
    id: r.id,
    category: r.category as DocRow['category'],
    name: r.name,
    issuedAt: r.issuedAt,
    expiresAt: r.expiresAt,
    fileUrl: r.fileUrl,
  }));
}

export type SaveDocState = { ok: boolean; message: string };

export async function createDocumentAction(input: {
  category: DocRow['category'];
  name: string;
  issuedAt: string;
  expiresAt: string;
  fileUrl: string;
}): Promise<SaveDocState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.insert(companyDocument).values({
      companyId: ctx.companyId,
      category: input.category,
      name: input.name,
      issuedAt: input.issuedAt || null,
      expiresAt: input.expiresAt || null,
      fileUrl: input.fileUrl || null,
    });
  });
  revalidatePath('/minha-contabilidade/arquivos');
  return { ok: true, message: 'Documento cadastrado.' };
}

export async function deleteDocumentAction(id: string): Promise<SaveDocState> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    await tx.delete(companyDocument).where(and(eq(companyDocument.id, id), eq(companyDocument.companyId, ctx.companyId)));
  });
  revalidatePath('/minha-contabilidade/arquivos');
  return { ok: true, message: 'Documento removido.' };
}
