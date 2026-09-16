'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { buildReportPdfData, type ReportType } from '@/lib/server/report-pdf-data';
import { renderReportPdf } from '@/lib/server/pdf/report-pdf';
import { makeContractSignatureService } from '@/lib/server/container';

export type SendReportSignatureState = { ok: boolean; message: string };

/**
 * Gera o PDF (timbrado) do relatório na hora e manda pra assinatura eletrônica
 * via DocuSeal — mesmo fluxo já usado pros contratos (ContractSignatureService),
 * só que o "subject" aqui é um documento avulso (type: 'DOCUMENT'), não
 * business_contract/lease.
 */
export async function sendReportForSignatureAction(
  reportType: ReportType,
  query: Record<string, string>,
  documentTitle: string,
  signerName: string,
  signerEmail: string,
): Promise<SendReportSignatureState> {
  if (!signerName.trim() || !signerEmail.trim()) {
    return { ok: false, message: 'Informe nome e e-mail do signatário.' };
  }

  try {
    const ctx = await getTenantContext();
    const pdfData = await buildReportPdfData(reportType, ctx, query);
    if (!pdfData) return { ok: false, message: 'Não foi possível gerar o relatório.' };

    const buffer = await renderReportPdf(pdfData, `${signerName}\n${signerEmail}`);
    const base64 = buffer.toString('base64');

    const result = await makeContractSignatureService().send(ctx, {
      title: documentTitle,
      documentBuffer: { base64, filename: `${reportType}.pdf` },
      signers: [{ name: signerName, email: signerEmail }],
      subject: { type: 'DOCUMENT', id: crypto.randomUUID() },
    });

    return { ok: true, message: `Enviado para ${signerEmail}. Status: ${result.status === 'SENT' ? 'aguardando assinatura' : result.status}.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao enviar para assinatura.' };
  }
}
