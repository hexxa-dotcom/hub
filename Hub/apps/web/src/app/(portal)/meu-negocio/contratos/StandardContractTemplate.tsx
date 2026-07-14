import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Tentar registrar fontes padrão para ficar mais bonito, mas o renderizador tem Helvetica padrão.
const styles = StyleSheet.create({
  page: {
    padding: 50,
    fontFamily: 'Helvetica',
    fontSize: 11,
    lineHeight: 1.5,
    color: '#333',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 20,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginTop: 15,
    marginBottom: 5,
  },
  paragraph: {
    marginBottom: 10,
    textAlign: 'justify',
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  signatureSection: {
    marginTop: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBlock: {
    width: '45%',
    borderTopWidth: 1,
    borderTopColor: '#000',
    paddingTop: 5,
    textAlign: 'center',
  }
});

export interface ContractData {
  contractor: {
    name: string;
    document: string; // CPF/CNPJ
    address: string;
  };
  contractee: {
    name: string;
    document: string; // CNPJ
    address: string;
  };
  service: {
    description: string;
    value: string;
    paymentTerms: string;
    deadline: string;
  };
  cityDate: string; // Ex: "São Paulo, SP, 01 de Janeiro de 2024"
}

export const StandardContractTemplate = ({ data }: { data: ContractData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</Text>

      <Text style={styles.sectionTitle}>1. DAS PARTES</Text>
      <Text style={styles.paragraph}>
        De um lado, <Text style={styles.bold}>{data.contractor.name}</Text>, inscrito(a) no CPF/CNPJ sob o nº <Text style={styles.bold}>{data.contractor.document}</Text>, com endereço em {data.contractor.address}, doravante denominado(a) <Text style={styles.bold}>CONTRATANTE</Text>.
      </Text>
      <Text style={styles.paragraph}>
        De outro lado, <Text style={styles.bold}>{data.contractee.name}</Text>, inscrito(a) no CNPJ sob o nº <Text style={styles.bold}>{data.contractee.document}</Text>, com endereço em {data.contractee.address}, doravante denominado(a) <Text style={styles.bold}>CONTRATADA</Text>.
      </Text>
      <Text style={styles.paragraph}>
        As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.
      </Text>

      <Text style={styles.sectionTitle}>2. DO OBJETO DO CONTRATO</Text>
      <Text style={styles.paragraph}>
        O presente contrato tem como objeto a prestação de serviços por parte da CONTRATADA à CONTRATANTE, consistentes em: <Text style={styles.bold}>{data.service.description}</Text>.
      </Text>
      <Text style={styles.paragraph}>
        Os serviços serão executados no prazo e vigência estipulados de: {data.service.deadline}.
      </Text>

      <Text style={styles.sectionTitle}>3. DO PREÇO E DAS CONDIÇÕES DE PAGAMENTO</Text>
      <Text style={styles.paragraph}>
        Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor total de <Text style={styles.bold}>{data.service.value}</Text>.
      </Text>
      <Text style={styles.paragraph}>
        As condições e formas de pagamento estabelecidas entre as partes serão: {data.service.paymentTerms}.
      </Text>

      <Text style={styles.sectionTitle}>4. DAS OBRIGAÇÕES DAS PARTES</Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>4.1.</Text> A CONTRATADA compromete-se a executar os serviços com zelo, qualidade e dentro dos prazos estipulados, mantendo a CONTRATANTE informada sobre o andamento.
      </Text>
      <Text style={styles.paragraph}>
        <Text style={styles.bold}>4.2.</Text> A CONTRATANTE compromete-se a fornecer todas as informações e documentos necessários para a execução dos serviços, bem como a efetuar o pagamento nos prazos acordados.
      </Text>

      <Text style={styles.sectionTitle}>5. DA RESCISÃO</Text>
      <Text style={styles.paragraph}>
        O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio por escrito de 30 (trinta) dias. Em caso de descumprimento de qualquer cláusula, o contrato poderá ser rescindido imediatamente.
      </Text>

      <Text style={styles.sectionTitle}>6. DO FORO</Text>
      <Text style={styles.paragraph}>
        Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de domicílio da CONTRATADA.
      </Text>

      <Text style={styles.paragraph}>
        E, por estarem assim justos e contratados, firmam o presente instrumento, que será assinado digitalmente para todos os efeitos legais.
      </Text>

      <Text style={[styles.paragraph, { marginTop: 30, textAlign: 'center' }]}>
        {data.cityDate}
      </Text>

      <View style={styles.signatureSection}>
        <View style={styles.signatureBlock}>
          <Text style={styles.bold}>{data.contractor.name}</Text>
          <Text>Contratante</Text>
        </View>
        <View style={styles.signatureBlock}>
          <Text style={styles.bold}>{data.contractee.name}</Text>
          <Text>Contratada</Text>
        </View>
      </View>
    </Page>
  </Document>
);
