import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer';
import type { DanfseData, DanfseEndereco } from './danfse';
import { regimeLabel } from '../danfse-shared';
import { NFSE_LOGO_BASE64 } from '../nfse-logo';
import { generateNfseQrCode } from './qrcode';

/**
 * Layout inspirado no DANFSe oficial (grade de campos rotulados, QR Code,
 * logo do Sistema Nacional NFS-e) — não é um clone pixel a pixel (o governo
 * não publica o template), mas segue a mesma estrutura de seções e a mesma
 * convenção de "-" para campo sem valor, pra ficar reconhecível a quem já
 * viu o documento oficial.
 */

const BORDER = '0.75pt solid #94a3b8';

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 7.5, color: '#0f172a', fontFamily: 'Helvetica' },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  logo: { width: 130, height: 26 },
  headerTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'center' },
  headerSubtitle: { fontSize: 8, textAlign: 'center', marginTop: 1 },
  headerRight: { alignItems: 'flex-end' },
  qr: { width: 56, height: 56, marginBottom: 2 },
  chaveBar: {
    border: BORDER,
    backgroundColor: '#f1f5f9',
    padding: 4,
    marginTop: 4,
    marginBottom: 4,
  },
  chaveLabel: { fontSize: 6, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#475569' },
  chaveValue: { fontFamily: 'Courier', fontSize: 9, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', border: BORDER, borderBottom: 'none' },
  gridLast: { flexDirection: 'row', border: BORDER },
  cell: { flex: 1, borderRight: BORDER, padding: 4 },
  cellLast: { flex: 1, padding: 4 },
  label: { fontSize: 6, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', color: '#475569', marginBottom: 1 },
  value: { fontSize: 8 },
  sectionBar: {
    backgroundColor: '#334155',
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    textTransform: 'uppercase',
    padding: '3 5',
    letterSpacing: 0.3,
  },
  fullCell: { border: BORDER, borderTop: 'none', padding: 4 },
  descBox: { border: BORDER, borderTop: 'none', padding: 5, minHeight: 34 },
  totalBar: {
    border: BORDER,
    borderTop: 'none',
    backgroundColor: '#f1f5f9',
    padding: 5,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  totalLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginRight: 4 },
  infoComp: { border: BORDER, borderTop: 'none', padding: 5, fontSize: 7, color: '#334155' },
  homologBanner: {
    border: '1.5pt solid #dc2626',
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    textAlign: 'center',
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    fontSize: 8,
    padding: 5,
    marginBottom: 6,
  },
  issRetidoNote: { color: '#b45309', backgroundColor: '#fffbeb', padding: 4, fontSize: 6.5 },
  footer: { marginTop: 10, textAlign: 'center', fontSize: 6.5, color: '#64748b' },
  footerBrand: { marginTop: 2, fontSize: 6.5, color: '#94a3b8', fontFamily: 'Helvetica-Bold' },
  sectionSpacer: { marginBottom: 8 },
});

const brl = (v: number) => v.toFixed(2);
/** Convenção do documento oficial: "-" quando o campo não tem valor. */
const dash = (v: string) => (v ? v : '-');
const dashN = (v: number) => (v ? `${brl(v)}` : '-');
const dashPct = (v: number) => (v ? `${brl(v)}%` : '-');
const enderecoLinha = (e: DanfseEndereco) =>
  [e.logradouro, e.numero, e.complemento, e.bairro, e.cep].filter(Boolean).join(', ') || '-';

function Field({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={last ? styles.cellLast : styles.cell}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionBar}>{children}</Text>;
}

function DanfseDocument({ data, qrDataUrl }: { data: DanfseData; qrDataUrl: string }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {data.homologacao && (
          <Text style={styles.homologBanner}>Ambiente de Homologação — Documento sem valor fiscal</Text>
        )}

        <View style={styles.headerTop}>
          <Image src={NFSE_LOGO_BASE64} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Documento Auxiliar da NFS-e</Text>
            <Text style={styles.headerSubtitle}>Padrão Nacional de Emissão de NFS-e</Text>
          </View>
          <View style={styles.headerRight}>
            <Image src={qrDataUrl} style={styles.qr} />
            <Text style={{ fontSize: 6, color: '#64748b' }}>Verificar autenticidade</Text>
          </View>
        </View>

        <View style={styles.chaveBar}>
          <Text style={styles.chaveLabel}>Chave de Acesso da NFS-e</Text>
          <Text style={styles.chaveValue}>{data.chaveAcesso}</Text>
        </View>

        <View style={styles.grid}>
          <Field label="Número da NFS-e" value={data.numero} />
          <Field label="Competência" value={data.competencia} />
          <Field label="Data e Hora da Emissão" value={data.dataEmissao} last />
        </View>
        <View style={styles.gridLast}>
          <Field label="Município" value={data.prestador.municipio} />
          <Field label="Ambiente" value={data.homologacao ? 'Homologação (teste)' : 'Produção'} last />
        </View>
        <View style={styles.sectionSpacer} />

        <SectionTitle>Prestador de Serviços</SectionTitle>
        <View style={styles.grid}>
          <Field label="CNPJ / CPF" value={dash(data.prestador.documento)} />
          <Field label="Regime Tributário" value={regimeLabel(data.prestador.regime)} last />
        </View>
        <View style={styles.fullCell}>
          <Text style={styles.label}>Nome / Nome Empresarial</Text>
          <Text style={styles.value}>{dash(data.prestador.nome)}</Text>
        </View>
        <View style={[styles.fullCell, { borderBottom: BORDER }]}>
          <Text style={styles.label}>Endereço</Text>
          <Text style={styles.value}>
            {data.prestador.endereco ? enderecoLinha(data.prestador.endereco) : '-'}
          </Text>
        </View>
        <View style={styles.sectionSpacer} />

        <SectionTitle>Tomador de Serviços</SectionTitle>
        <View style={styles.grid}>
          <Field label="CNPJ / CPF" value={dash(data.tomador.documento)} />
          <Field label="E-mail" value={dash(data.tomador.email)} last />
        </View>
        <View style={styles.fullCell}>
          <Text style={styles.label}>Nome / Nome Empresarial</Text>
          <Text style={styles.value}>{dash(data.tomador.nome)}</Text>
        </View>
        <View style={[styles.fullCell, { borderBottom: BORDER }]}>
          <Text style={styles.label}>Endereço</Text>
          <Text style={styles.value}>{data.tomador.endereco ? enderecoLinha(data.tomador.endereco) : '-'}</Text>
        </View>
        <View style={styles.sectionSpacer} />

        <SectionTitle>Serviço Prestado</SectionTitle>
        <View style={styles.grid}>
          <Field label="Código de Tributação Nacional" value={dash(data.codigoTributacaoNacional)} />
          <Field label="Local da Prestação" value={dash(data.localPrestacao)} last />
        </View>
        <View style={[styles.descBox, { borderBottom: BORDER }]}>
          {!!data.descricaoTributacaoNacional && (
            <Text style={{ fontSize: 6.5, color: '#64748b', marginBottom: 3 }}>
              {data.descricaoTributacaoNacional}
            </Text>
          )}
          <Text style={styles.label}>Descrição do Serviço</Text>
          <Text style={styles.value}>{data.descricaoServico}</Text>
        </View>
        <View style={styles.sectionSpacer} />

        <SectionTitle>Tributação Municipal (ISSQN)</SectionTitle>
        <View style={styles.grid}>
          <Field label="BC ISSQN (R$)" value={dashN(data.valores.baseCalculo)} />
          <Field label="Alíquota Aplicada" value={dashPct(data.valores.aliquotaIss)} />
          <Field label="Retenção do ISSQN" value={data.issRetido ? 'Retido' : 'Não Retido'} />
          {/* ISS apurado é sempre um resultado calculado de verdade (mesmo
              quando dá zero, como em nota isenta) — nunca "-", diferente de
              BC/alíquota que podem genuinamente não se aplicar (ex.: MEI). */}
          <Field label="ISSQN Apurado (R$)" value={brl(data.valores.valorIss)} last />
        </View>
        {data.issRetido && <Text style={[styles.issRetidoNote, { borderLeft: BORDER, borderRight: BORDER }]}>ISS retido pelo tomador dos serviços.</Text>}
        <View style={{ borderBottom: BORDER }} />
        <View style={styles.sectionSpacer} />

        <SectionTitle>Tributação IBS / CBS (Reforma Tributária — LC 214/2025)</SectionTitle>
        <View style={styles.grid}>
          <Field label="CST / Classificação Tributária" value={`${dash(data.ibsCbs.cst)} / ${dash(data.ibsCbs.classTrib)}`} />
          <Field label="Local de Incidência" value={dash(data.ibsCbs.localIncidencia)} last />
        </View>
        <View style={styles.grid}>
          <Field label="Alíquota IBS UF / Efetiva" value={`${dashPct(data.ibsCbs.aliquotaIbsUf)} / ${dashPct(data.ibsCbs.aliquotaEfetivaIbsUf)}`} />
          <Field label="Valor Apurado IBS UF (R$)" value={dashN(data.ibsCbs.valorIbsUf)} last />
        </View>
        <View style={styles.grid}>
          <Field label="Alíquota IBS Município / Efetiva" value={`${dashPct(data.ibsCbs.aliquotaIbsMun)} / ${dashPct(data.ibsCbs.aliquotaEfetivaIbsMun)}`} />
          <Field label="Valor Apurado IBS Município (R$)" value={dashN(data.ibsCbs.valorIbsMun)} last />
        </View>
        <View style={styles.gridLast}>
          <Field label="Alíquota CBS / Efetiva" value={`${dashPct(data.ibsCbs.aliquotaCbs)} / ${dashPct(data.ibsCbs.aliquotaEfetivaCbs)}`} />
          <Field label="Valor Total Apurado (IBS + CBS) (R$)" value={dashN(data.ibsCbs.valorIbsTotal + data.ibsCbs.valorCbs)} last />
        </View>
        <View style={styles.sectionSpacer} />

        <SectionTitle>Valor Total da NFS-e</SectionTitle>
        <View style={styles.gridLast}>
          <Field label="Valor da Operação / Serviço (R$)" value={brl(data.valores.valorServico)} />
          <Field label="Valor Líquido da NFS-e (R$)" value={brl(data.valores.valorLiquido)} last />
        </View>
        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Valor Líquido da Nota:</Text>
          <Text style={{ fontSize: 12, fontFamily: 'Courier-Bold' }}>R$ {brl(data.valores.valorLiquido)}</Text>
        </View>
        <View style={styles.sectionSpacer} />

        {data.valores.tributosAproximados > 0 && (
          <>
            <SectionTitle>Informações Complementares</SectionTitle>
            <Text style={styles.infoComp}>
              Totais aproximados dos tributos cfe. Lei nº 12.741/2012: R$ {brl(data.valores.tributosAproximados)}.
            </Text>
          </>
        )}

        <View style={styles.footer}>
          <Text>Documento auxiliar sem validade fiscal por si só — a NFS-e válida é o XML assinado digitalmente.</Text>
          <Text>Consulte a autenticidade no Portal Nacional da NFS-e (nfse.gov.br) utilizando a chave de acesso ou o QR Code acima.</Text>
          <Text style={styles.footerBrand}>Emitido através do sistema Hexx Hub Gestão Digital</Text>
        </View>
      </Page>
    </Document>
  );
}

/** Gera o PDF do DANFSe a partir dos dados já extraídos do XML (ver danfse.ts). */
export async function renderDanfsePdf(data: DanfseData): Promise<Buffer> {
  const qrDataUrl = await generateNfseQrCode(data.chaveAcesso);
  return renderToBuffer(<DanfseDocument data={data} qrDataUrl={qrDataUrl} />);
}
