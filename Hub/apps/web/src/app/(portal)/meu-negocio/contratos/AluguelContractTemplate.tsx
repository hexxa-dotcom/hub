import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

export interface AluguelContractData {
  locador: { name: string; document: string; address: string };
  locatario: { name: string; document: string; address: string };
  imovel: { label: string; endereco: string };
  aluguel: { valor: string; indice: 'IPCA' | 'IGPM'; vencimento: string };
  vigencia: { inicio: string; fim: string };
  cityDate: string;
}

const styles = StyleSheet.create({
  page: { padding: 50, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.5, color: '#333' },
  title: { fontSize: 16, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 20, textTransform: 'uppercase' },
  sectionTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', marginTop: 15, marginBottom: 5 },
  paragraph: { marginBottom: 10, textAlign: 'justify' },
  bold: { fontFamily: 'Helvetica-Bold' },
  signatureSection: { marginTop: 50, flexDirection: 'row', justifyContent: 'space-between' },
  signatureBlock: { width: '45%', borderTopWidth: 1, borderTopColor: '#000', paddingTop: 5, textAlign: 'center' },
});

export const AluguelContractTemplate = ({ data }: { data: AluguelContractData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Contrato de Locação</Text>

      <Text style={styles.sectionTitle}>1. DAS PARTES</Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>LOCADOR(A):</Text> {data.locador.name}, inscrito(a) no CPF/CNPJ sob o nº <Text style={styles.bold}>{data.locador.document}</Text>, com endereço em {data.locador.address}.
      </Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>LOCATÁRIO(A):</Text> {data.locatario.name}, inscrito(a) no CPF/CNPJ sob o nº <Text style={styles.bold}>{data.locatario.document}</Text>, com endereço em {data.locatario.address}.
      </Text>

      <Text style={styles.sectionTitle}>2. DO OBJETO</Text>
      <Text style={styles.paragraph}>
        O LOCADOR dá em locação ao LOCATÁRIO o imóvel <Text style={styles.bold}>{data.imovel.label}</Text>, situado em {data.imovel.endereco}, para fins não residenciais/residenciais conforme uso já acordado entre as partes.
      </Text>

      <Text style={styles.sectionTitle}>3. DO ALUGUEL E REAJUSTE</Text>
      <Text style={styles.paragraph}>
        O valor mensal do aluguel é de <Text style={styles.bold}>{data.aluguel.valor}</Text>, com vencimento todo dia {data.aluguel.vencimento} de cada mês, via PIX/transferência bancária.
      </Text>
      <Text style={styles.paragraph}>
        O valor será reajustado anualmente pela variação acumulada do índice <Text style={styles.bold}>{data.aluguel.indice}</Text>, ou outro que legalmente o substitua.
      </Text>

      <Text style={styles.sectionTitle}>4. DA VIGÊNCIA</Text>
      <Text style={styles.paragraph}>
        O presente contrato vigorará de <Text style={styles.bold}>{data.vigencia.inicio}</Text> até <Text style={styles.bold}>{data.vigencia.fim}</Text>, podendo ser renovado por acordo entre as partes.
      </Text>

      <Text style={styles.sectionTitle}>5. DAS OBRIGAÇÕES DAS PARTES</Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>5.1.</Text> O LOCATÁRIO compromete-se a usar o imóvel de acordo com sua destinação, zelar pela sua conservação e efetuar o pagamento do aluguel nos prazos acordados.
      </Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>5.2.</Text> O LOCADOR compromete-se a manter o imóvel em condições de uso e a garantir o uso pacífico do bem durante a vigência do contrato.
      </Text>

      <Text style={styles.sectionTitle}>6. DA RESCISÃO</Text>
      <Text style={styles.paragraph}>
        O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio por escrito de 30 (trinta) dias, ou imediatamente em caso de descumprimento de qualquer cláusula.
      </Text>

      <Text style={styles.sectionTitle}>7. DO FORO</Text>
      <Text style={styles.paragraph}>
        Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de situação do imóvel.
      </Text>

      <Text style={[styles.paragraph, { marginTop: 30, textAlign: 'center' }]}>{data.cityDate}</Text>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBlock}>
          <Text style={styles.bold}>{data.locador.name}</Text>
          <Text>Locador(a)</Text>
        </View>
        <View style={styles.signatureBlock}>
          <Text style={styles.bold}>{data.locatario.name}</Text>
          <Text>Locatário(a)</Text>
        </View>
      </View>
    </Page>
  </Document>
);
