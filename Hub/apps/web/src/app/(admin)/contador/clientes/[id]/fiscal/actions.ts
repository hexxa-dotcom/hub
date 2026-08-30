'use server';

import { taxHistory, getDb, eq, and, withDbTimeout } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';

/**
 * Token do Oneflow é POR EMPRESA CLIENTE (a doc deles não expõe CNPJ nas
 * chamadas de fiscal/contábil — só funciona "no contexto do token"), e fica
 * só aqui na área do contador — o cliente não vê nem mexe nisso.
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
    const text = pdfData.text;

    // Extrai os dados do texto do PGDAS via regex. Se algum campo essencial
    // não for encontrado, falha explicitamente em vez de gravar um valor
    // fabricado — dado fiscal errado é pior do que nenhum dado.
    let rba12 = 0;
    let aliquota = 0;
    let anexo = 'Anexo III'; // default
    let referenceMonth = new Date().toISOString().slice(0, 7); // default YYYY-MM

    // Regex to extract RBA12
    const rbaMatch = text.match(/(?:RBA12|Receita Bruta Acumulada).*?(?:R\$)?\s*([\d\.]+,\d{2})/i);
    if (rbaMatch) {
      rba12 = parseFloat(rbaMatch[1].replace(/\./g, '').replace(',', '.'));
    } else {
      return {
        success: false,
        error: 'Não foi possível encontrar a Receita Bruta Acumulada (RBA12) no PDF. Confira se é um PGDAS válido ou lance os dados manualmente.',
      };
    }

    // Regex to extract aliquota
    const aliquotaMatch = text.match(/Alíquota.*?(?:efetiva|nominal).*?(\d+,\d{2})\s*%/i);
    if (aliquotaMatch) {
      aliquota = parseFloat(aliquotaMatch[1].replace(',', '.'));
    } else {
      return {
        success: false,
        error: 'Não foi possível encontrar a alíquota efetiva/nominal no PDF. Confira se é um PGDAS válido ou lance os dados manualmente.',
      };
    }

    // Reference month regex "Período de Apuração (PA): 05/2024"
    const paMatch = text.match(/Período de Apuração[^\d]*?(\d{2})\/(\d{4})/i);
    if (paMatch) {
      referenceMonth = `${paMatch[2]}-${paMatch[1]}`;
    }

    // Determine tax bracket (Anexo) based on text.
    if (text.match(/Anexo I\b/i)) anexo = 'Anexo I';
    else if (text.match(/Anexo II\b/i)) anexo = 'Anexo II';
    else if (text.match(/Anexo III\b/i)) anexo = 'Anexo III';
    else if (text.match(/Anexo IV\b/i)) anexo = 'Anexo IV';
    else if (text.match(/Anexo V\b/i)) anexo = 'Anexo V';

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
