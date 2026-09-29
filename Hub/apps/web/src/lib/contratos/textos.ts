/**
 * TEXTOS DO CONTRATO E DOS TERMOS — versionados.
 *
 * Mudou uma vírgula? Sobe a versão. O aceite guarda a versão e o hash do texto
 * que a pessoa viu; texto novo pede aceite novo (ver `precisaDeAceite`).
 *
 * O contrato segue a Resolução CFC 1.590/2020 (art. 2º, alíneas a–m), o
 * distrato (art. 6º a 8º), a ITG 1000 (Carta de Responsabilidade) e a Lei
 * 9.613/1998. Os Termos cobrem o uso da plataforma e a LGPD (Lei 13.709/2018).
 *
 * RASCUNHO para revisão de advogado antes de ir aos clientes.
 */

export interface Secao {
  titulo: string;
  itens: string[];
}

export const VERSAO_CONTRATO = 'v1 · 29/09/2026';
export const VERSAO_TERMOS = 'v1 · 29/09/2026';

/** Contrato-padrão: as partes, os valores e as datas ficam no Termo de Adesão. */
export const CONTRATO: Secao[] = [
  {
    titulo: '1. Partes e forma de adesão',
    itens: [
      'Este Contrato de Prestação de Serviços Contábeis é celebrado entre a CONTRATADA e a CONTRATANTE identificadas no Termo de Adesão, que é parte integrante deste contrato.',
      'A CONTRATANTE adere a este contrato por aceite eletrônico dentro da plataforma Hexx, feito por seu representante, o que tem validade jurídica nos termos do art. 10, § 2º, da Medida Provisória nº 2.200-2/2001 e do art. 107 do Código Civil. A plataforma registra data, hora, endereço IP, usuário e a versão exata dos documentos aceitos.',
      'O responsável técnico pelos serviços é o profissional da contabilidade indicado no Termo de Adesão, com registro ativo no Conselho Regional de Contabilidade.',
    ],
  },
  {
    titulo: '2. Serviços contratados (permanentes)',
    itens: [
      'Escrituração contábil, na forma da ITG 1000 e das Normas Brasileiras de Contabilidade aplicáveis, a partir dos documentos e informações fornecidos pela CONTRATANTE.',
      'Elaboração do balancete, do Balanço Patrimonial e da Demonstração do Resultado do Exercício, ao término de cada exercício.',
      'Apuração dos tributos da CONTRATANTE no regime em que estiver enquadrada, com a emissão das guias de recolhimento e a entrega das obrigações acessórias correspondentes (como PGDAS-D, DEFIS, DCTFWeb e EFD-Reinf, conforme o caso).',
      'Departamento pessoal para os sócios (pró-labore) e para os empregados informados pela CONTRATANTE, com folha de pagamento, encargos e obrigações do eSocial, nos limites do plano contratado.',
      'Orientação contábil e tributária relacionada aos serviços acima, pelos canais de atendimento da plataforma.',
      'Acesso à plataforma Hexx para envio de documentos, emissão de notas fiscais de serviço, acompanhamento financeiro e consulta das guias e relatórios.',
    ],
  },
  {
    titulo: '3. Serviços eventuais',
    itens: [
      'Serviços não listados na cláusula 2 — como abertura, alteração ou baixa de empresa, regularizações de períodos anteriores ao início deste contrato, declarações retificadoras causadas por informação incorreta da CONTRATANTE, perícias, laudos e consultorias específicas — são eventuais e serão cobrados à parte, mediante orçamento prévio aprovado pela CONTRATANTE.',
    ],
  },
  {
    titulo: '4. O que cabe à CONTRATANTE',
    itens: [
      'Emitir nota fiscal de todos os serviços que prestar e de todas as vendas que realizar. A contabilidade registra como faturamento as receitas documentadas por nota fiscal; recebimentos sem nota serão reconhecidos como receita, na forma das normas contábeis, e comunicados à CONTRATANTE para regularização.',
      'Enviar pela plataforma, até o dia 5 de cada mês, os documentos do mês anterior: extratos bancários de todas as contas, notas fiscais recebidas, recibos e comprovantes de despesas, e informações de admissão, demissão, férias e alterações de empregados.',
      'Manter atualizado o certificado digital da empresa (e-CNPJ A1), necessário à emissão de notas e ao envio de obrigações, e informar à CONTRATADA qualquer alteração cadastral, societária ou de atividade.',
      'Efetuar o pagamento dos tributos nas datas de vencimento das guias disponibilizadas na plataforma. Multas e juros decorrentes de pagamento em atraso ou de documentos enviados fora do prazo são de responsabilidade da CONTRATANTE.',
      'Fornecer, ao fim de cada exercício, a Carta de Responsabilidade da Administração prevista na ITG 1000, confirmando que as informações e documentos entregues são completos e verdadeiros. Sem ela, as demonstrações do exercício não serão encerradas.',
      'Guardar os documentos originais pelo prazo legal.',
    ],
  },
  {
    titulo: '5. Responsabilidades da CONTRATADA',
    itens: [
      'Executar os serviços com zelo, diligência e observância das Normas Brasileiras de Contabilidade, do Código de Ética Profissional do Contador e da legislação vigente.',
      'Cumprir os prazos legais das obrigações sob sua responsabilidade, desde que os documentos tenham sido entregues no prazo da cláusula 4.',
      'Manter sigilo sobre as informações da CONTRATANTE, salvo quando exigidas por lei ou autoridade competente.',
      'A CONTRATADA responde pelos erros técnicos que cometer. Não responde por informações e documentos incompletos, incorretos ou entregues fora do prazo pela CONTRATANTE, nem por atos de gestão da CONTRATANTE.',
    ],
  },
  {
    titulo: '6. Honorários, pagamento e reajuste',
    itens: [
      'Pelos serviços da cláusula 2, a CONTRATANTE pagará os honorários mensais indicados no Termo de Adesão, no dia de vencimento lá definido, por boleto, Pix ou cartão emitidos pela plataforma.',
      'Serão cobrados adicionalmente, conforme a tabela do plano, os empregados, sócios e eventos de departamento pessoal que excederem o incluído no plano, discriminados na fatura do mês.',
      'Os honorários serão reajustados anualmente, no mês de aniversário do contrato, pela variação acumulada do IPCA/IBGE nos doze meses anteriores, ou por outro índice oficial que o substitua.',
      'O atraso no pagamento sujeita a CONTRATANTE a multa de 2% e juros de 1% ao mês. Após 30 dias de atraso, a CONTRATADA poderá suspender os serviços mediante aviso prévio pela plataforma, sem prejuízo das obrigações já vencidas.',
    ],
  },
  {
    titulo: '7. Prazo e alterações',
    itens: [
      'Este contrato vigora por prazo indeterminado, a partir da data de início indicada no Termo de Adesão.',
      'Alterações de plano, de honorários ou do escopo serão formalizadas por novo Termo de Adesão ou por aditivo, aceitos na plataforma.',
    ],
  },
  {
    titulo: '8. Prevenção à lavagem de dinheiro',
    itens: [
      'A CONTRATANTE declara ter ciência de que a CONTRATADA está sujeita à Lei nº 9.613/1998 e às normas do Conselho Federal de Contabilidade sobre prevenção à lavagem de dinheiro e ao financiamento do terrorismo, devendo comunicar ao COAF as operações e propostas de operações previstas nessas normas, sem que isso configure quebra de sigilo ou gere responsabilidade à CONTRATADA.',
    ],
  },
  {
    titulo: '9. Proteção de dados',
    itens: [
      'No tratamento dos dados pessoais contidos nos documentos contábeis, fiscais e trabalhistas da CONTRATANTE, a CONTRATADA atua como operadora e a CONTRATANTE como controladora, nos termos da Lei nº 13.709/2018 (LGPD), aplicando-se também os Termos de Uso e a Política de Privacidade da plataforma.',
    ],
  },
  {
    titulo: '10. Rescisão e distrato',
    itens: [
      'Qualquer das partes pode rescindir este contrato, sem multa, mediante aviso prévio de 30 dias pela plataforma ou por escrito. Durante o aviso prévio, os serviços e os honorários continuam devidos.',
      'Ao término, as partes celebrarão distrato, na forma da Resolução CFC nº 1.590/2020, indicando os serviços concluídos e os pendentes.',
      'A CONTRATADA disponibilizará, em até 30 dias após o fim do aviso prévio, os livros, registros auxiliares, documentos e arquivos eletrônicos das obrigações entregues ao Fisco, pela própria plataforma ou por meio eletrônico, e comunicará ao novo responsável técnico os fatos de que ele deva tomar conhecimento.',
      'O descumprimento grave de obrigação contratual por qualquer das partes permite a rescisão imediata, por escrito.',
    ],
  },
  {
    titulo: '11. Foro',
    itens: [
      'Fica eleito o foro da comarca da sede da CONTRATADA, indicada no Termo de Adesão, para dirimir as questões oriundas deste contrato.',
    ],
  },
];

/** Termos de Uso e Política de Privacidade da plataforma. */
export const TERMOS: Secao[] = [
  {
    titulo: '1. O que é a plataforma',
    itens: [
      'A Hexx Gestão Digital é uma plataforma de contabilidade on-line operada pela empresa indicada como CONTRATADA no Termo de Adesão. Estes Termos regem o uso do sistema; os serviços contábeis são regidos pelo Contrato de Prestação de Serviços Contábeis.',
    ],
  },
  {
    titulo: '2. Acesso e responsabilidades do usuário',
    itens: [
      'O acesso é pessoal. O usuário é responsável pela guarda da sua senha e pelas ações feitas com seu acesso, e declara ter poderes para representar a empresa cadastrada.',
      'O usuário se compromete a enviar informações verdadeiras e a não usar a plataforma para fins ilícitos.',
      'O certificado digital enviado à plataforma é guardado cifrado e usado apenas para os serviços contratados (emissão de notas fiscais, consulta e envio de obrigações).',
    ],
  },
  {
    titulo: '3. Inteligência artificial',
    itens: [
      'A plataforma usa inteligência artificial para organizar e classificar documentos e movimentações bancárias. Os lançamentos contábeis e as obrigações entregues ficam sob a responsabilidade técnica do profissional da contabilidade, que revisa o que a automação produz.',
      'As informações enviadas a provedores de inteligência artificial são as estritamente necessárias à tarefa e não são usadas por eles para treinar modelos.',
    ],
  },
  {
    titulo: '4. Dados pessoais (LGPD)',
    itens: [
      'Dados de cadastro e de uso da plataforma (nome, e-mail, telefone, registros de acesso): a operadora da plataforma é controladora, e os trata para prestar o serviço, cumprir obrigações legais e garantir a segurança do sistema.',
      'Dados pessoais contidos nos documentos contábeis, fiscais e trabalhistas da empresa cliente (como dados de empregados, sócios, clientes e fornecedores): a empresa cliente é controladora e a operadora da plataforma é operadora, tratando-os apenas para executar o contrato e cumprir a legislação.',
      'Os dados são compartilhados somente com órgãos públicos quando a lei exige (Receita Federal, prefeituras, eSocial, entre outros), com instituições financeiras para cobrança e com fornecedores de tecnologia necessários ao funcionamento da plataforma (hospedagem, banco de dados, e-mail, assinatura e inteligência artificial), sob dever de confidencialidade.',
      'Os documentos contábeis e fiscais são guardados pelos prazos legais (em regra, 5 anos para tributos e até 10 anos para documentos contábeis e trabalhistas). Os demais dados são excluídos ou anonimizados ao fim da relação, salvo obrigação legal de guarda.',
      'O titular pode pedir confirmação, acesso, correção, portabilidade e exclusão dos seus dados, e informações sobre o compartilhamento, pelo e-mail de contato indicado no Termo de Adesão.',
    ],
  },
  {
    titulo: '5. Segurança e disponibilidade',
    itens: [
      'A plataforma adota medidas técnicas de segurança, como criptografia de senhas, chaves e certificados, e controle de acesso por empresa. Incidentes de segurança que possam causar risco relevante serão comunicados aos afetados e à ANPD, na forma da lei.',
      'A plataforma pode passar por manutenções e interrupções. Prazos legais não dependem exclusivamente dela: documentos devem ser enviados com antecedência.',
    ],
  },
  {
    titulo: '6. Alterações',
    itens: [
      'Estes Termos podem ser atualizados. A nova versão será apresentada na plataforma e exigirá novo aceite para continuar o uso.',
    ],
  },
];

/** Texto corrido de um documento — base do hash que prova o que foi aceito. */
export function textoCorrido(secoes: Secao[]): string {
  return secoes.map((s) => `${s.titulo}\n${s.itens.join('\n')}`).join('\n\n');
}
