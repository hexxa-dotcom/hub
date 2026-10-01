import 'server-only';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer';
import { brl, formatarDocumento } from '../danfse-shared';
import QRCode from 'qrcode';
import type { ReciboItem } from '../recibo-rules';
import { RECIBO_LOGO } from '../recibo-logo';

export interface ReciboAluguelData {
  tipo?: 'LOCACAO' | 'PAGAMENTO';
  descricao?: string;
  itens?: ReciboItem[];
  assinatura?: { metodo:'HUB'; nome:string; em:string; autorizacaoId:string; conteudoHash:string; exemplo?:boolean };
  notaFiscal?: string | null;
  urlVerificacao?: string;
  numeroRecibo: string;
  mesReferencia: string; // ex: "10/2026" ou "Outubro/2026"
  dataVencimento: string; // "DD/MM/AAAA"
  dataPagamento?: string | null; // "DD/MM/AAAA"
  status: 'PAID' | 'PENDING' | 'OVERDUE';
  locador: {
    nome: string;
    documento: string;
    endereco: string;
    email?: string | null;
  };
  locatario: {
    nome: string;
    documento: string;
    endereco?: string | null;
    email?: string | null;
  };
  imovel: {
    label: string;
    endereco: string;
  };
  valores: {
    aluguel: number;
    condominio?: number;
    iptu?: number;
    desconto?: number;
    total: number;
  };
  dadosPagamento?: {
    forma: string; // "PIX", "Transferência", etc.
    chavePix?: string | null;
    banco?: string | null;
  };
  codigoVerificacao?: string;
  cidadeData: string;
}

const BORDER_COLOR = '#D8DDD6';
const BORDER = `0.75pt solid ${BORDER_COLOR}`;

const styles = StyleSheet.create({
  page: {
    padding: 28,
    fontSize: 8.5,
    color: '#141615',
    fontFamily: 'Helvetica',
    backgroundColor: '#FFFFFF',
    lineHeight: 1.2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottom: '1.5pt solid #141615',
    marginBottom: 10,
  },
  brandTitle: {
    fontSize: 30,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: -1.5,
    textTransform: 'uppercase',
    color: '#141615',
  },
  brandSubtitle: {
    fontSize: 7.5,
    color: '#6E6A61',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  docTypeBox: {
    alignItems: 'flex-end',
  },
  docTypeTag: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    color: '#141615',
  },
  receiptNumber: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#141615',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgePaid: {
    backgroundColor: '#DFFFAE',
    color: '#2F4A3C',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
    color: '#92400E',
  },
  badgeOverdue: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  sectionTitleBar: {
    backgroundColor: '#E7EAE5',
    color: '#2F4A3C',
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    textTransform: 'uppercase',
    padding: '5 8',
    letterSpacing: 0.5,
    marginTop: 7,
    marginBottom: 0,
  },
  twoCols: {
    flexDirection: 'row',
    border: BORDER,
    borderTop: 'none',
  },
  col: {
    flex: 1,
    padding: 6,
  },
  colDivider: {
    borderRight: BORDER,
  },
  label: {
    fontSize: 6.5,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#6E6A61',
    marginBottom: 1.5,
  },
  valBold: {
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#141615',
    marginBottom: 2,
  },
  valText: {
    fontSize: 8,
    color: '#231F20',
    marginBottom: 1,
  },
  boxSingle: {
    border: BORDER,
    borderTop: 'none',
    padding: 6,
  },
  tableRow: {
    flexDirection: 'row',
    border: BORDER,
    borderTop: 'none',
    padding: '5 8',
    alignItems: 'center',
  },
  tableColDesc: {
    flex: 3,
  },
  tableColVal: {
    flex: 1,
    textAlign: 'right',
  },
  totalBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#DFFFAE',
    border: BORDER,
    borderTop: 'none',
    padding: '10 10',
  },
  totalLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    color: '#141615',
  },
  totalValue: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#141615',
  },
  legalNoticeBox: {
    backgroundColor: '#F5F6F4',
    border: BORDER,
    borderTop: 'none',
    padding: 6,
    fontSize: 7,
    color: '#6E6A61',
    lineHeight: 1.35,
  },
  legalTitle: {
    fontFamily: 'Helvetica-Bold',
    textTransform: 'uppercase',
    fontSize: 6.5,
    marginBottom: 2,
    color: '#141615',
  },
  signaturesArea: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  qrBlock: {
    alignItems: 'center',
    width: 90,
  },
  qrImage: {
    width: 64,
    height: 64,
    marginBottom: 3,
  },
  qrCaption: {
    fontSize: 6,
    color: '#6E6A61',
    textAlign: 'center',
  },
  signatureBlock: {
    width: 300,
    borderTop: '1pt solid #141615',
    paddingTop: 6,
    textAlign: 'center',
    marginTop: 0,
  },
  signName: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8.5,
  },
  signRole: {
    fontSize: 7.5,
    color: '#6E6A61',
    marginTop: 1,
  },
  footerText: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 6.5,
    color: '#6E6A61',
    borderTop: '0.5pt solid #D8DDD6',
    paddingTop: 6,
  },
});

export function ReciboAluguelDocument({ data, qrDataUrl, compact = false }: { data: ReciboAluguelData; qrDataUrl?: string; compact?: boolean }) {
  const isPaid = data.status === 'PAID';
  const locacao = data.tipo !== 'PAGAMENTO';
  const isOverdue = data.status === 'OVERDUE';
  const statusLabel = isPaid ? 'Quitado / Pago' : isOverdue ? 'Vencido' : 'Aguardando Pagamento';
  const statusStyle = isPaid ? styles.badgePaid : isOverdue ? styles.badgeOverdue : styles.badgePending;

  return (
    <Document>
      <Page size="A4" style={[styles.page, compact ? {fontSize:7, lineHeight:1, padding:22} : {}]}>
        {/* TOPO */}
        <View style={styles.header}>
          <View>
            <Image src={RECIBO_LOGO} style={{ width: 120, height: 28, objectFit: 'contain' }} />
            <Text style={[styles.brandSubtitle, { marginTop: 8 }]}>Recibos e pagamentos</Text>
          </View>
          <View style={styles.docTypeBox}>
            <Text style={styles.docTypeTag}>{locacao ? (isPaid ? 'Recibo de locação' : 'Demonstrativo de locação') : 'Recibo de pagamento'}</Text>
            <Text style={styles.receiptNumber}>{data.numeroRecibo}</Text>
            <Text style={[styles.statusBadge, statusStyle]}>{statusLabel}</Text>
          </View>
        </View>

        {/* PARTES: LOCADOR E LOCATÁRIO */}
        <Text style={styles.sectionTitleBar}>1. Identificação das Partes</Text>
        <View style={styles.twoCols}>
          <View style={[styles.col, styles.colDivider]}>
            <Text style={styles.label}>{locacao ? 'Locador' : 'Recebedor'}</Text>
            <Text style={styles.valBold}>{data.locador.nome}</Text>
            <Text style={styles.valText}>CNPJ/CPF: {formatarDocumento(data.locador.documento)}</Text>
            <Text style={styles.valText}>{data.locador.endereco}</Text>
            {data.locador.email && <Text style={styles.valText}>E-mail: {data.locador.email}</Text>}
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>{locacao ? 'Locatário' : 'Pagador'}</Text>
            <Text style={styles.valBold}>{data.locatario.nome}</Text>
            <Text style={styles.valText}>CNPJ/CPF: {formatarDocumento(data.locatario.documento)}</Text>
            {data.locatario.endereco && <Text style={styles.valText}>{data.locatario.endereco}</Text>}
            {data.locatario.email && <Text style={styles.valText}>E-mail: {data.locatario.email}</Text>}
          </View>
        </View>

        {/* IMÓVEL E PERÍODO */}
        <Text style={styles.sectionTitleBar}>2. Objeto e Período de Referência</Text>
        <View style={styles.boxSingle}>
          <Text style={styles.label}>{locacao ? 'Imóvel locado' : 'Referente a'}</Text>
          <Text style={styles.valBold}>{data.imovel.label}</Text>
          {locacao && <Text style={styles.valText}>{data.imovel.endereco}</Text>}
          {data.notaFiscal && <Text style={styles.valText}>Nota fiscal vinculada: {data.notaFiscal}</Text>}
        </View>
        <View style={styles.twoCols}>
          <View style={[styles.col, styles.colDivider]}>
            <Text style={styles.label}>Mês de Referência</Text>
            <Text style={styles.valBold}>{data.mesReferencia}</Text>
          </View>
          <View style={[styles.col, styles.colDivider]}>
            <Text style={styles.label}>Data de Vencimento</Text>
            <Text style={styles.valBold}>{data.dataVencimento}</Text>
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>Data de Quitação</Text>
            <Text style={styles.valBold}>{data.dataPagamento || (isPaid ? 'Confirmado' : 'Em aberto')}</Text>
          </View>
        </View>

        {/* DISCRIMINAÇÃO DOS VALORES */}
        <Text style={styles.sectionTitleBar}>3. Discriminação dos Valores</Text>
        {(data.itens || [
          {descricao:data.descricao || (locacao ? 'Aluguel' : 'Pagamento recebido'),valor:data.valores.aluguel},
          ...(data.valores.condominio ? [{descricao:'Condomínio — reembolso',valor:data.valores.condominio}] : []),
          ...(data.valores.iptu ? [{descricao:'IPTU — reembolso',valor:data.valores.iptu}] : []),
          ...(data.valores.desconto ? [{descricao:'Desconto',valor:data.valores.desconto,desconto:true}] : []),
        ]).map((item,index) => <View key={index} style={[styles.tableRow,compact ? {paddingVertical:3} : {}]}>
          <View style={styles.tableColDesc}><Text style={styles.valText}>{item.descricao}</Text></View>
          <View style={styles.tableColVal}><Text style={styles.valBold}>{item.desconto ? '- ' : ''}R$ {brl(item.valor)}</Text></View>
        </View>)}

        <View style={styles.totalBar}>
          <Text style={styles.totalLabel}>Valor Líquido Total</Text>
          <Text style={styles.totalValue}>R$ {brl(data.valores.total)}</Text>
        </View>

        {/* FORMA DE PAGAMENTO */}
        {data.dadosPagamento && (
          <View style={styles.boxSingle}>
            <Text style={styles.label}>Instruções para Pagamento / Quitação</Text>
            <Text style={styles.valText}>
              Forma: <Text style={styles.valBold}>{data.dadosPagamento.forma}</Text>
              {data.dadosPagamento.chavePix ? ` · Chave PIX: ${data.dadosPagamento.chavePix}` : ''}
              {data.dadosPagamento.banco ? ` · Banco: ${data.dadosPagamento.banco}` : ''}
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitleBar}>4. Declaração</Text>
        <View style={styles.legalNoticeBox}>
          <Text style={{ marginBottom: 6 }}>
            {isPaid
              ? `${data.locador.nome} declara ter recebido de ${data.locatario.nome} o valor de R$ ${brl(data.valores.total)}, referente exclusivamente ao pagamento descrito neste documento${data.dataPagamento ? `, em ${data.dataPagamento}` : ''}.`
              : 'Este demonstrativo informa o valor a receber. Não comprova pagamento nem concede quitação.'}
          </Text>
          <Text>Este documento não substitui nota fiscal. {data.assinatura ? 'A assinatura eletrônica pode ser conferida pela consulta pública.' : 'A assinatura abaixo deve ser realizada pelo recebedor, quando necessária.'}</Text>
        </View>

        {/* Data em linha própria; QR e assinatura não disputam largura. */}
        <Text style={{fontSize:7.5,color:'#6E6A61',marginTop:12,textAlign:'right'}}>{data.cidadeData}</Text>
        <View style={styles.signaturesArea} wrap={false}>
          <View style={styles.qrBlock}>
            {qrDataUrl && <Image src={qrDataUrl} style={styles.qrImage} />}
            <Text style={styles.qrCaption}>{data.urlVerificacao ? 'Conferir documento' : 'Identificação do documento'}</Text>
            {data.codigoVerificacao && <Text style={[styles.qrCaption,{fontFamily:'Courier',fontSize:6,marginTop:2}]}>{data.codigoVerificacao}</Text>}
          </View>
          <View style={{width:300}}>
            <View style={{height:48,justifyContent:'center',alignItems:'center'}}>
              {data.assinatura && <>
                <Text style={{fontSize:8,fontFamily:'Helvetica-Bold',color:'#2F4A3C'}}>{data.assinatura.exemplo ? 'EXEMPLO DE ASSINATURA ELETRÔNICA' : 'ASSINADO ELETRONICAMENTE NO HUB'}</Text>
                <Text style={{fontSize:7,marginTop:4}}>{data.assinatura.nome}</Text>
                <Text style={{fontSize:6.5,marginTop:3}}>{data.assinatura.em} · Emissão automática autorizada</Text>
              </>}
            </View>
            <View style={styles.signatureBlock}>
              <Text style={styles.signName}>{data.locador.nome}</Text>
              <Text style={styles.signRole}>{locacao ? 'Locador / Administrador' : 'Recebedor'}</Text>
              {data.assinatura && <Text style={{fontSize:6,color:'#6E6A61',marginTop:3}}>Autoria e integridade: consulte o QR code.</Text>}
            </View>
          </View>
        </View>

        {/* RODAPÉ */}
        <Text style={styles.footerText}>
          Gerado pela Hexx · Recibo de pagamento e documento fiscal têm finalidades distintas.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderReciboAluguelPdf(data: ReciboAluguelData): Promise<Buffer> {
  let qrDataUrl: string | undefined;
  if (data.urlVerificacao) {
    const url = data.urlVerificacao;
    qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 200, errorCorrectionLevel: 'M' });
  }
  for (const compact of [false,true]) {
    const buffer=await renderToBuffer(<ReciboAluguelDocument data={data} qrDataUrl={qrDataUrl} compact={compact} />);
    // react-pdf emits page dictionaries as plain objects (content streams are compressed).
    if ((buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length === 1) return buffer;
  }
  throw new Error('O conteúdo excede uma página. Reduza as descrições antes de emitir o recibo.');
}
