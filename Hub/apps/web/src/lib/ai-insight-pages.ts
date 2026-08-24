/** Registro das telas que têm a Hexxa Insights ligada — usado pra montar os toggles por seção em /contador/configuracoes/ia-insights. */
export const AI_INSIGHT_PAGES: { key: string; label: string }[] = [
  { key: 'cliente', label: 'Início (Resumo do Cliente)' },
  { key: 'minha-contabilidade/socios', label: 'Gestão de Sócios' },
  { key: 'minha-contabilidade/guias', label: 'Guias de Impostos' },
  { key: 'meu-negocio/contratos', label: 'Contratos' },
  { key: 'meu-negocio/notas', label: 'Notas Fiscais' },
  { key: 'meu-negocio/hub-financeiro', label: 'Resumo Financeiro' },
  { key: 'patrimonial', label: 'Gestão de Patrimônio' },
];
