'use server';

import { taxHistory, getDb, eq, and, withDbTimeout } from '@hexxa/db';
import { lerExtratoPgdas } from '@hexxa/core';
import { integrationCredential } from '@hexxa/db/schema';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';

/**
 * Token do Oneflow é POR EMPRESA CLIENTE (a doc deles não expõe CNPJ nas
 * chamadas de fiscal/contábil — só funciona "no contexto do token"), e fica
 * só aqui na área do contador — o cliente não vê nem mexe nisso.
 *
 * STATUS: salva de verdade (provider='oneflow' em integration_credential),
 * mas hoje NENHUM código lê esse token de volta — órfão até a integração
 * real de puxar guia/dado do OneFlow (Omie) ser construída. Não confundir
 * com o provider='omie' usado por packages/core/src/services/omie-integration.service.ts
 * (também ainda placeholder, mas é o lado do TENANT, não do contador).
 * Quando for implementar a automação de guias do OneFlow, reaproveitar esta
 * estrutura em vez de criar uma terceira.
 */
export async function getOneflowCredential(companyId: string): Promise<{ hasToken: boolean; active: boolean }> {
  await requireAdmin();
  const db = getDb();
  const [row] = await withDbTimeout(
    db
      .select({ active: integrationCredential.active })
      .from(integrationCredential)
      .where(and(eq(integrationCredential.companyId, companyId), eq(integrationCredential.provider, 'oneflow'))),
    8000,
  );
  return { hasToken: !!row, active: row?.active ?? false };
}

export async function saveOneflowToken(companyId: string, token: string) {
  await requireAdmin();
  if (!token.trim()) throw new Error('Cole o token do Oneflow dessa empresa.');
  const db = getDb();
  const [existing] = await withDbTimeout(
    db
      .select({ id: integrationCredential.id })
      .from(integrationCredential)
      .where(and(eq(integrationCredential.companyId, companyId), eq(integrationCredential.provider, 'oneflow'))),
    8000,
  );

  if (existing) {
    await withDbTimeout(
      db
        .update(integrationCredential)
        .set({ secretRef: { token: token.trim() }, active: true })
        .where(eq(integrationCredential.id, existing.id)),
      8000,
    );
  } else {
    await withDbTimeout(
      db.insert(integrationCredential).values({
        companyId,
        kind: 'ERP',
        provider: 'oneflow',
        secretRef: { token: token.trim() },
        active: true,
      }),
      8000,
    );
  }

  revalidatePath(`/contador/clientes/${companyId}/fiscal`);
  return { success: true };
}

export async function disconnectOneflow(companyId: string) {
  await requireAdmin();
  const db = getDb();
  await withDbTimeout(
    db
      .update(integrationCredential)
      .set({ active: false })
      .where(and(eq(integrationCredential.companyId, companyId), eq(integrationCredential.provider, 'oneflow'))),
    8000,
  );
  revalidatePath(`/contador/clientes/${companyId}/fiscal`);
  return { success: true };
}

export async function processPGDAS(companyId: string, formData: FormData) {
  await requireAdmin();
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('Nenhum arquivo enviado.');

    // require() só aqui dentro (nunca no topo do módulo): o pdf-parse
    // referencia DOMMatrix (global de browser) em algum ponto da cadeia de
    // import dele, e o build do Next avalia o módulo inteiro na hora de
    // "collect page data" — um require de topo derruba o build inteiro.
    const pdfParse = require('pdf-parse');

    // Ler o arquivo PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);

    /**
     * A leitura mora em `lerExtratoPgdas`, testada, e não mais aqui.
     *
     * Estava inline, com as regex no meio da gravação no banco e sem teste
     * nenhum — um parser de documento fiscal sem teste funciona no PDF de
     * quem o escreveu e ninguém sabe o que faz no próximo. A mesma função
     * atende o cliente no primeiro acesso.
     */
    const leitura = lerExtratoPgdas(pdfData.text);
    if (!leitura.ok || !leitura.extrato) {
      return { success: false, error: leitura.motivo ?? 'Não consegui ler o extrato.' };
    }
    const rba12 = leitura.extrato.rbt12;
    const aliquota = leitura.extrato.aliquotaEfetiva ?? 0;
    const anexo = leitura.extrato.anexo ?? 'Anexo III';
    const referenceMonth = leitura.extrato.competencia ?? new Date().toISOString().slice(0, 7);

    // Insert into database
    const db = getDb();
    await withDbTimeout(
      db.insert(taxHistory).values({
        companyId,
        referenceMonth,
        rba12: rba12.toString(),
        effectiveRate: aliquota.toString(),
        taxBracket: anexo,
      }).onConflictDoUpdate({
        target: [taxHistory.companyId, taxHistory.referenceMonth],
        set: {
          rba12: rba12.toString(),
          effectiveRate: aliquota.toString(),
          taxBracket: anexo,
        }
      }),
      8000,
    );

    revalidatePath(`/contador/clientes/${companyId}/fiscal`);
    revalidatePath('/minha-contabilidade/termometro-tributario');
    return { success: true, rba12, aliquota, anexo, referenceMonth };
  } catch (err: any) {
    console.error('Error processing PGDAS:', err);
    return { success: false, error: err.message || 'Erro ao processar PDF' };
  }
}
