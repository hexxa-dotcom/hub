import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

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
  /**
   * Categoria do serviço (valor de CATEGORIA_SERVICO_OPTIONS no wizard) —
   * quando reconhecida, adiciona um bloco de cláusulas de boas práticas
   * específicas dessa categoria (texto fixo, revisado, NUNCA gerado por IA
   * por contrato — ver CATEGORY_CLAUSES abaixo). Categorias sem bloco
   * definido simplesmente não ganham a seção extra.
   */
  categoria?: string;
}

/**
 * Cláusulas de boas práticas por categoria de serviço — conteúdo fixo,
 * pensado pra ser um contrato sólido e enxuto (não uma peça de 20 páginas),
 * cobrindo os pontos de maior risco jurídico de cada tipo de serviço.
 * IMPORTANTE: isto é um modelo de referência de mercado, não substitui
 * revisão por um advogado antes de uso em contratos de valor relevante.
 */
const CATEGORY_CLAUSES: Record<string, { heading: string; items: string[] }> = {
  MEDICO: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — SERVIÇOS DE SAÚDE',
    items: [
      'A CONTRATADA declara possuir registro regular no Conselho Regional de Medicina (CRM) ou conselho de classe profissional aplicável, comprometendo-se a exercer suas atividades em conformidade com o respectivo Código de Ética Profissional.',
      'Dados de pacientes eventualmente acessados no âmbito deste contrato constituem dado pessoal sensível nos termos da Lei nº 13.709/2018 (LGPD), devendo ser tratados com o sigilo profissional aplicável, mantido inclusive após o término deste contrato.',
      'A responsabilidade técnica pelos atos profissionais praticados é pessoal e exclusiva do profissional que os praticou, nos termos da legislação aplicável ao exercício da medicina, não recaindo sobre a CONTRATANTE.',
    ],
  },
  MARKETING: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — MARKETING E CONTEÚDO',
    items: [
      'Os direitos patrimoniais sobre artes, textos, vídeos e demais materiais produzidos especificamente para a CONTRATANTE no âmbito deste contrato serão a ela cedidos mediante a quitação integral do valor pactuado, ressalvado à CONTRATADA o direito de uso do material para fins de portfólio próprio, salvo restrição expressa em contrário.',
      'Publicações e materiais destinados a veiculação pública estarão sujeitos à aprovação prévia da CONTRATANTE, salvo definição diversa acordada expressamente entre as partes.',
      'Eventual uso de marca, identidade visual ou imagem da CONTRATANTE pela CONTRATADA está autorizado exclusivamente para os fins deste contrato.',
    ],
  },
  SOCIAL_MIDIA: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — GESTÃO DE REDES SOCIAIS',
    items: [
      'Os direitos patrimoniais sobre artes, textos, vídeos e demais materiais produzidos especificamente para a CONTRATANTE no âmbito deste contrato serão a ela cedidos mediante a quitação integral do valor pactuado, ressalvado à CONTRATADA o direito de uso do material para fins de portfólio próprio, salvo restrição expressa em contrário.',
      'Publicações estarão sujeitas a aprovação prévia da CONTRATANTE antes de sua veiculação, salvo definição diversa acordada expressamente entre as partes, incluindo eventual calendário editorial combinado à parte.',
      'O acesso da CONTRATADA às contas/senhas de redes sociais da CONTRATANTE, quando necessário à execução deste contrato, é concedido em caráter temporário e deve ser revogado ao término da vigência.',
    ],
  },
  TI: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — TECNOLOGIA E DESENVOLVIMENTO',
    items: [
      'Salvo disposição em contrário, os direitos patrimoniais sobre softwares, códigos-fonte e demais materiais desenvolvidos especificamente para a CONTRATANTE no âmbito deste contrato são cedidos à CONTRATANTE mediante a quitação integral do valor pactuado.',
      'As partes comprometem-se a manter sigilo sobre informações técnicas, comerciais e credenciais de acesso trocadas durante a vigência deste contrato, obrigação que subsiste por 2 (dois) anos após seu término.',
      'Defeitos de funcionamento identificados em até 30 (trinta) dias da entrega e decorrentes de erro na execução do serviço estão cobertos pelo valor pactuado, não se incluindo alterações de escopo ou novas funcionalidades.',
    ],
  },
  COMERCIAL: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — COMERCIAL E VENDAS',
    items: [
      'Quando pactuado comissionamento, o valor devido à CONTRATADA será calculado com base no percentual acordado sobre as vendas efetivamente realizadas e pagas, conforme condições estabelecidas entre as partes.',
      'A CONTRATADA não possui poderes para assumir obrigações em nome da CONTRATANTE além daquelas expressamente autorizadas por escrito.',
      'Despesas de deslocamento, hospedagem e demais custos operacionais correm por conta de quem os houver contratado, salvo disposição em contrário.',
    ],
  },
  CONSULTORIA: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — CONSULTORIA',
    items: [
      'O escopo de entregáveis é o definido neste contrato; qualquer alteração de escopo deve ser formalizada por escrito entre as partes, podendo impactar prazo e/ou valor.',
      'As partes comprometem-se a manter sigilo sobre informações estratégicas, comerciais e operacionais trocadas durante a vigência deste contrato, obrigação que subsiste após seu término.',
      'A CONTRATADA exerce a atividade com autonomia técnica e metodológica, não se sujeitando a subordinação hierárquica ou controle de jornada por parte da CONTRATANTE.',
    ],
  },
  DESIGN: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — DESIGN E CRIAÇÃO',
    items: [
      'Os direitos patrimoniais sobre as peças e materiais gráficos desenvolvidos especificamente para a CONTRATANTE são a ela cedidos mediante a quitação integral do valor pactuado, ressalvado à CONTRATADA o direito de uso do material para fins de portfólio próprio, salvo restrição expressa em contrário.',
      'O número de rodadas de revisão/ajuste incluído no valor pactuado é o combinado entre as partes; alterações adicionais de escopo podem gerar custo à parte, mediante acordo prévio.',
      'A CONTRATADA poderá ser citada como autora do material produzido, salvo pedido expresso de anonimato pela CONTRATANTE.',
    ],
  },
  JURIDICO: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — SERVIÇOS JURÍDICOS',
    items: [
      'A CONTRATADA declara possuir inscrição regular nos quadros da Ordem dos Advogados do Brasil (OAB) ou órgão de classe aplicável, comprometendo-se a observar o respectivo Código de Ética e Disciplina.',
      'Informações e documentos compartilhados no âmbito deste contrato estão protegidos por sigilo profissional advogado-cliente, nos termos da Lei nº 8.906/1994 (Estatuto da Advocacia).',
      'Custas processuais, honorários periciais e demais despesas judiciais não estão incluídos no valor pactuado, correndo por conta da CONTRATANTE, salvo disposição em contrário.',
    ],
  },
  CONTABIL: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — SERVIÇOS CONTÁBEIS E FINANCEIROS',
    items: [
      'A CONTRATADA compromete-se a observar as Normas Brasileiras de Contabilidade (NBC) e a legislação fiscal e tributária aplicável na execução dos serviços.',
      'As partes comprometem-se a manter sigilo sobre dados financeiros, fiscais e societários da CONTRATANTE, obrigação que subsiste após o término deste contrato.',
      'A CONTRATANTE é responsável por fornecer, em tempo hábil, a documentação necessária ao cumprimento de obrigações fiscais e prazos legais; atrasos na entrega de documentos pela CONTRATANTE podem impactar os prazos de entrega dos serviços.',
    ],
  },
  PJ_AUTONOMO: {
    heading: 'DISPOSIÇÕES ESPECÍFICAS — PRESTAÇÃO AUTÔNOMA',
    items: [
      'A CONTRATADA presta os serviços com seus próprios meios, equipamentos e organização de horário, sem subordinação hierárquica ou controle de jornada por parte da CONTRATANTE.',
      'A CONTRATADA é responsável pela emissão de nota fiscal correspondente aos valores recebidos, bem como pelo recolhimento dos tributos incidentes sobre sua atividade.',
      'Eventual acesso a sistemas, ferramentas ou ambientes da CONTRATANTE concedido à CONTRATADA se dá exclusivamente para fins de execução deste contrato.',
    ],
  },
};

export const StandardContractTemplate = ({ data }: { data: ContractData }) => {
  const categoryBlock = data.categoria ? CATEGORY_CLAUSES[data.categoria] : undefined;
  // Numeração das cláusulas: 1-Partes, 2-Objeto, 3-Preço, 4-Obrigações,
  // 5-Natureza da contratação (fixa), [6-Específicas da categoria, se houver],
  // Rescisão e Foro nos últimos dois números.
  const rescisaoNum = categoryBlock ? 7 : 6;
  const foroNum = rescisaoNum + 1;

  return (
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

        <Text style={styles.sectionTitle}>5. DA NATUREZA DA CONTRATAÇÃO</Text>
        <Text style={styles.paragraph}>
          O presente contrato tem natureza estritamente civil, não gerando vínculo empregatício, societário ou de subordinação entre as partes, nos termos dos artigos 442 e seguintes da Consolidação das Leis do Trabalho (CLT) e do art. 593 do Código Civil, sendo a CONTRATADA responsável pelo recolhimento de seus próprios tributos e encargos previdenciários.
        </Text>

        {categoryBlock && (
          <>
            <Text style={styles.sectionTitle}>6. {categoryBlock.heading}</Text>
            {categoryBlock.items.map((item, i) => (
              <Text key={i} style={styles.paragraph}>
                <Text style={styles.bold}>6.{i + 1}.</Text> {item}
              </Text>
            ))}
          </>
        )}

        <Text style={styles.sectionTitle}>{rescisaoNum}. DA RESCISÃO</Text>
        <Text style={styles.paragraph}>
          O presente contrato poderá ser rescindido por qualquer das partes, mediante aviso prévio por escrito de 30 (trinta) dias. Em caso de descumprimento de qualquer cláusula, o contrato poderá ser rescindido imediatamente.
        </Text>

        <Text style={styles.sectionTitle}>{foroNum}. DO FORO</Text>
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
};
