/**
 * Os modelos de contrato, as áreas e os índices de reajuste — só os nomes e
 * os textos de partida, sem as cláusulas (que vivem em `modelos.ts`, junto do
 * PDF). Leve para a tela.
 */

export type ModeloDeContrato = 'CLIENTE' | 'PROJETO' | 'SOFTWARE' | 'PJ' | 'FORNECEDOR' | 'OUTRO';

export interface InfoDoModelo {
  titulo: string;
  /** `null`: quem escolhe é a pessoa (modelo "Outro"). */
  tipo: 'ENTRADA' | 'SAIDA' | null;
  rotulo: string;
  resumo: string;
  parte: string;
}

export const MODELOS: Record<ModeloDeContrato, InfoDoModelo> = {
  CLIENTE: {
    titulo: 'Contrato de Prestação de Serviços',
    tipo: 'ENTRADA',
    rotulo: 'Serviço contínuo para um cliente',
    resumo: 'Você presta o serviço e recebe todo mês.',
    parte: 'Cliente',
  },
  PROJETO: {
    titulo: 'Contrato de Prestação de Serviços por Projeto',
    tipo: 'ENTRADA',
    rotulo: 'Projeto com escopo fechado',
    resumo: 'Um trabalho com entregas definidas, pago em parcelas.',
    parte: 'Cliente',
  },
  SOFTWARE: {
    titulo: 'Contrato de Licença de Uso de Software',
    tipo: 'ENTRADA',
    rotulo: 'Assinatura de software ou plataforma',
    resumo: 'O cliente usa o seu sistema e paga a mensalidade.',
    parte: 'Cliente',
  },
  PJ: {
    titulo: 'Contrato de Prestação de Serviços Profissionais (PJ)',
    tipo: 'SAIDA',
    rotulo: 'Contratar um profissional PJ',
    resumo: 'Um colaborador como pessoa jurídica, sem vínculo de emprego.',
    parte: 'Profissional',
  },
  FORNECEDOR: {
    titulo: 'Contrato de Prestação de Serviços',
    tipo: 'SAIDA',
    rotulo: 'Contratar um fornecedor',
    resumo: 'Uma empresa que presta serviço para você.',
    parte: 'Fornecedor',
  },
  OUTRO: {
    titulo: 'Contrato de Prestação de Serviços',
    tipo: null,
    rotulo: 'Outro tipo de serviço',
    resumo: 'Um contrato geral de serviço — você diz se recebe ou paga.',
    parte: 'Outra parte',
  },
};

export const INDICES = {
  IPCA: 'IPCA (IBGE)',
  IGPM: 'IGP-M (FGV)',
  NENHUM: 'Sem reajuste',
} as const;
export type IndiceDeReajuste = keyof typeof INDICES;

/**
 * Área do serviço: acrescenta cláusulas específicas no contrato (ver
 * CATEGORY_CLAUSES) e já sugere o texto do serviço — que a pessoa ajusta ou
 * deixa como está.
 */
export const AREAS: { value: string; label: string; texto: string }[] = [
  { value: '', label: 'Geral', texto: '' },
  {
    value: 'CONSULTORIA',
    label: 'Consultoria',
    texto:
      'Consultoria com diagnóstico da situação atual, recomendações por escrito e acompanhamento da implementação, com reuniões periódicas e um relatório mensal das ações e resultados.',
  },
  {
    value: 'TI',
    label: 'Tecnologia / TI',
    texto:
      'Desenvolvimento, manutenção e suporte de sistemas, incluindo correção de falhas, pequenas melhorias e atendimento a chamados em horário comercial, com registro das demandas atendidas.',
  },
  {
    value: 'MARKETING',
    label: 'Marketing',
    texto:
      'Planejamento e execução do marketing digital, incluindo gestão de campanhas pagas, criação de peças, acompanhamento de métricas e um relatório mensal de resultados com recomendações.',
  },
  {
    value: 'SOCIAL_MIDIA',
    label: 'Social mídia',
    texto:
      'Gestão das redes sociais, com planejamento do calendário de conteúdo, criação e publicação das postagens, interação com o público e relatório mensal de desempenho.',
  },
  {
    value: 'DESIGN',
    label: 'Design / criação',
    texto:
      'Criação de peças gráficas e identidade visual conforme briefing, com até duas rodadas de ajustes por peça e entrega dos arquivos finais em formatos para impressão e digital.',
  },
  {
    value: 'COMERCIAL',
    label: 'Comercial / vendas',
    texto:
      'Prospecção e atendimento comercial, com apresentação dos produtos e serviços, negociação dentro das condições definidas pela contratante e registro das oportunidades em relatório mensal.',
  },
  {
    value: 'MEDICO',
    label: 'Saúde',
    texto:
      'Atendimento em saúde na especialidade da contratada, conforme agenda combinada entre as partes, com registro em prontuário e observância das normas do respectivo conselho profissional.',
  },
  {
    value: 'JURIDICO',
    label: 'Jurídico',
    texto:
      'Assessoria jurídica consultiva, com análise e elaboração de contratos e documentos, orientação sobre questões do dia a dia da empresa e pareceres por escrito quando solicitados.',
  },
  {
    value: 'CONTABIL',
    label: 'Contábil / financeiro',
    texto:
      'Serviços contábeis e fiscais, incluindo escrituração, apuração dos tributos, emissão das guias, entrega das obrigações acessórias e demonstrações contábeis periódicas.',
  },
  {
    value: 'PJ_AUTONOMO',
    label: 'Autônomo',
    texto: 'Prestação de serviços autônomos de ',
  },
];
