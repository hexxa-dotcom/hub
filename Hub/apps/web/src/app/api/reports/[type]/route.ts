import { NextResponse } from 'next/server';
import { getTenantContext } from '@/lib/server/tenant';
import { buildReportPdfData, type ReportType } from '@/lib/server/report-pdf-data';
import { renderReportPdf } from '@/lib/server/pdf/report-pdf';

const VALID_TYPES: ReportType[] = ['balanco', 'faturamento', 'faturamento-por-cliente'];

/** GET /api/reports/{balanco|faturamento|faturamento-por-cliente}?<mesmos query params da página> → PDF pra download, com timbrado. */
export async function GET(req: Request, { params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!VALID_TYPES.includes(type as ReportType)) {
    return NextResponse.json({ error: 'Relatório desconhecido.' }, { status: 404 });
  }

  const ctx = await getTenantContext();
  const url = new URL(req.url);
  const query = Object.fromEntries(url.searchParams.entries());

  const pdfData = await buildReportPdfData(type as ReportType, ctx, query);
  if (!pdfData) {
    return NextResponse.json({ error: 'Não foi possível gerar o relatório.' }, { status: 500 });
  }

  const buffer = await renderReportPdf(pdfData);
  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${type}.pdf"`,
    },
  });
}
