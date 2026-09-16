import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

/**
 * Gerador de PDF genérico com timbrado (razão social/CNPJ/endereço) pra
 * qualquer relatório financeiro — Balanço, DRE, Faturamento, Faturamento
 * por Cliente. Em vez de um template React-PDF por relatório (~90% igual
 * entre eles: cabeçalho, cards de resumo, tabelas), cada página monta um
 * `ReportPdfData` com seus próprios números e este arquivo só desenha.
 */

export interface ReportCompanyIdentity {
  legalName: string;
  cnpj: string | null;
  address: string | null;
}

export interface ReportPdfTable {
  heading: string;
  headers: string[];
  rows: string[][];
  /** Linha final em destaque (ex: total) — índice na lista `rows`. */
  highlightRowIndex?: number;
}

export interface ReportPdfData {
  reportTitle: string;
  periodLabel: string;
  company: ReportCompanyIdentity;
  summaryCards: { label: string; value: string }[];
  tables: ReportPdfTable[];
  note?: string;
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 9, color: '#0f172a', fontFamily: 'Helvetica' },
  letterheadBar: { borderBottom: '1.5pt solid #1E3328', paddingBottom: 10, marginBottom: 14 },
  companyName: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1E3328' },
  companyMeta: { fontSize: 8, color: '#475569', marginTop: 2 },
  reportTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10 },
  reportTitle: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  periodLabel: { fontSize: 9, color: '#475569', textTransform: 'capitalize' },
  generatedAt: { fontSize: 7, color: '#94a3b8', marginTop: 2 },
  cardsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  card: { flex: 1, border: '0.75pt solid #cbd5e1', borderRadius: 4, padding: 8, backgroundColor: '#f8fafc' },
  cardLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#64748b' },
  cardValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1E3328', marginTop: 2 },
  sectionHeading: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginBottom: 6, marginTop: 12 },
  table: { border: '0.75pt solid #cbd5e1', borderRadius: 3 },
  tHeadRow: { flexDirection: 'row', backgroundColor: '#1E3328' },
  tHeadCell: { flex: 1, padding: 5, fontSize: 7, fontFamily: 'Helvetica-Bold', color: '#DFFFAE', textTransform: 'uppercase' },
  tRow: { flexDirection: 'row', borderTop: '0.5pt solid #e2e8f0' },
  tRowHighlight: { flexDirection: 'row', borderTop: '0.75pt solid #1E3328', backgroundColor: '#f1f5f9' },
  tCell: { flex: 1, padding: 5, fontSize: 8 },
  tCellBold: { flex: 1, padding: 5, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  note: { fontSize: 7, color: '#64748b', marginTop: 10, lineHeight: 1.4 },
  signatureBlock: { marginTop: 42, flexDirection: 'row', justifyContent: 'space-around' },
  signatureLine: { width: 200, borderTop: '0.75pt solid #0f172a', paddingTop: 4, textAlign: 'center', fontSize: 7.5 },
  footer: { position: 'absolute', bottom: 24, left: 32, right: 32, textAlign: 'center', fontSize: 6.5, color: '#94a3b8' },
});

function ReportPdfDocument({ data, signerLabel }: { data: ReportPdfData; signerLabel?: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.letterheadBar}>
          <Text style={styles.companyName}>{data.company.legalName}</Text>
          <Text style={styles.companyMeta}>
            {data.company.cnpj ? `CNPJ ${data.company.cnpj}` : ''}
            {data.company.cnpj && data.company.address ? ' — ' : ''}
            {data.company.address ?? ''}
          </Text>
          <View style={styles.reportTitleRow}>
            <View>
              <Text style={styles.reportTitle}>{data.reportTitle}</Text>
              <Text style={styles.periodLabel}>{data.periodLabel}</Text>
            </View>
            <Text style={styles.generatedAt}>Gerado em {new Date().toLocaleString('pt-BR')}</Text>
          </View>
        </View>

        {data.summaryCards.length > 0 && (
          <View style={styles.cardsRow}>
            {data.summaryCards.map((c) => (
              <View key={c.label} style={styles.card}>
                <Text style={styles.cardLabel}>{c.label}</Text>
                <Text style={styles.cardValue}>{c.value}</Text>
              </View>
            ))}
          </View>
        )}

        {data.tables.map((t) => (
          <View key={t.heading} wrap={false}>
            <Text style={styles.sectionHeading}>{t.heading}</Text>
            <View style={styles.table}>
              <View style={styles.tHeadRow}>
                {t.headers.map((h) => (
                  <Text key={h} style={styles.tHeadCell}>{h}</Text>
                ))}
              </View>
              {t.rows.map((row, i) => (
                <View key={i} style={i === t.highlightRowIndex ? styles.tRowHighlight : styles.tRow}>
                  {row.map((cell, j) => (
                    <Text key={j} style={i === t.highlightRowIndex ? styles.tCellBold : styles.tCell}>{cell}</Text>
                  ))}
                </View>
              ))}
            </View>
          </View>
        ))}

        {data.note && <Text style={styles.note}>{data.note}</Text>}

        {signerLabel && (
          <View style={styles.signatureBlock}>
            <Text style={styles.signatureLine}>{signerLabel}</Text>
          </View>
        )}

        <Text style={styles.footer} fixed>
          Hexxa Hub — documento gerado automaticamente a partir dos lançamentos registrados no sistema.
        </Text>
      </Page>
    </Document>
  );
}

/** `signerLabel`, quando informado, reserva uma linha de assinatura (nome do signatário) — usado quando o PDF vai ser enviado pra assinatura eletrônica. */
export async function renderReportPdf(data: ReportPdfData, signerLabel?: string): Promise<Buffer> {
  return renderToBuffer(<ReportPdfDocument data={data} signerLabel={signerLabel} />);
}
