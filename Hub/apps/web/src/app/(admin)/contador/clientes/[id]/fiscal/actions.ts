'use server';

import { taxHistory, getDb } from '@hexxa/db';
import { revalidatePath } from 'next/cache';
const pdfParse = require('pdf-parse');

export async function processPGDAS(companyId: string, formData: FormData) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('Nenhum arquivo enviado.');
    
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
    await db.insert(taxHistory).values({
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
    });

    revalidatePath(`/contador/clientes/${companyId}/fiscal`);
    revalidatePath('/minha-contabilidade/termometro-tributario');
    return { success: true, rba12, aliquota, anexo, referenceMonth };
  } catch (err: any) {
    console.error('Error processing PGDAS:', err);
    return { success: false, error: err.message || 'Erro ao processar PDF' };
  }
}
