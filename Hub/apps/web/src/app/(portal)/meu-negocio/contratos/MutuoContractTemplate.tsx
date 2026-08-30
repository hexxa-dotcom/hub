import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

export interface MutuoContractData {
  mutuante: { name: string; document: string; address: string };
  mutuario: { name: string; document: string; address: string };
  loan: { value: string; interestRate: string; paymentTerms: string; deadline: string };
  cityDate: string;
}

Font.register({
  family: 'Open Sans',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-regular.ttf' },
    { src: 'https://cdn.jsdelivr.net/npm/open-sans-all@0.1.3/fonts/open-sans-bold.ttf', fontWeight: 'bold' }
  ]
});

const styles = StyleSheet.create({
  page: { padding: 50, fontFamily: 'Open Sans', fontSize: 11, color: '#231F20', lineHeight: 1.5 },
  header: { fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginBottom: 20, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', marginTop: 15, marginBottom: 5 },
  text: { marginBottom: 10, textAlign: 'justify' },
  bold: { fontWeight: 'bold' },
  signatureBlock: { marginTop: 40, width: '45%', borderTopWidth: 1, borderColor: '#000', paddingTop: 5, textAlign: 'center' },
  signaturesRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 },
  footer: { position: 'absolute', bottom: 30, left: 50, right: 50, textAlign: 'center', fontSize: 9, color: '#6E6A61' }
});

export function MutuoContractTemplate({ data }: { data: MutuoContractData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.header}>INSTRUMENTO PARTICULAR DE CONTRATO DE MÚTUO FINANCEIRO</Text>

        <Text style={styles.sectionTitle}>1. AS PARTES</Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>MUTUANTE (Credor):</Text> {data.mutuante.name}, inscrito(a) no CPF/CNPJ sob o nº {data.mutuante.document}, com endereço em {data.mutuante.address}.
        </Text>
        <Text style={styles.text}>
          <Text style={styles.bold}>MUTUÁRIO (Devedor):</Text> {data.mutuario.name}, inscrito(a) no CPF/CNPJ sob o nº {data.mutuario.document}, com endereço em {data.mutuario.address}.
        </Text>

        <Text style={styles.sectionTitle}>2. O OBJETO</Text>
        <Text style={styles.text}>
          O MUTUANTE entrega neste ato ao MUTUÁRIO, a título de mútuo financeiro, a quantia de <Text style={styles.bold}>{data.loan.value}</Text>, 
          a ser transferida via TED/PIX para a conta bancária de titularidade do MUTUÁRIO.
        </Text>

        <Text style={styles.sectionTitle}>3. DOS ENCARGOS E JUROS REMUNERATÓRIOS</Text>
        <Text style={styles.text}>
          Para fins de obediência à legislação tributária e societária (afastando a presunção de Distribuição Disfarçada de Lucros - DDL), 
          incidirão sobre o valor mutuado juros remuneratórios de <Text style={styles.bold}>{data.loan.interestRate}</Text> ao mês, pro rata die.
        </Text>

        <Text style={styles.sectionTitle}>4. DO PRAZO E FORMA DE PAGAMENTO</Text>
        <Text style={styles.text}>
          O valor principal e os juros serão pagos da seguinte forma: <Text style={styles.bold}>{data.loan.paymentTerms}</Text>.
          O vencimento final da obrigação dar-se-á em: <Text style={styles.bold}>{data.loan.deadline}</Text>.
        </Text>

        <Text style={styles.sectionTitle}>5. DA INADIMPLÊNCIA</Text>
        <Text style={styles.text}>
          Em caso de atraso, incidirá multa de 2% (dois por cento) sobre o valor da parcela em atraso e juros moratórios de 1% (um por cento) ao mês.
        </Text>

        <Text style={styles.sectionTitle}>6. DO FORO</Text>
        <Text style={styles.text}>
          As partes elegem o foro do local da assinatura deste contrato para dirimir eventuais controvérsias judiciais, abdicando de qualquer outro, por mais privilegiado que seja.
        </Text>

        <Text style={[styles.text, { marginTop: 20, textAlign: 'center' }]}>
          {data.cityDate}
        </Text>

        <View style={styles.signaturesRow}>
          <View style={styles.signatureBlock}>
            <Text style={styles.bold}>{data.mutuante.name}</Text>
            <Text>Mutuante (Credor)</Text>
          </View>
          <View style={styles.signatureBlock}>
            <Text style={styles.bold}>{data.mutuario.name}</Text>
            <Text>Mutuário (Devedor)</Text>
          </View>
        </View>

        <Text style={styles.footer}>Gerado através da plataforma Hexx Hub — Evidência Tributária e Compliance Societário.</Text>
      </Page>
    </Document>
  );
}
