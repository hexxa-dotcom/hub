export type NavItem = { label: string; href: string; badge?: string };
export type NavSection = { title: string; items: NavItem[] };

/**
 * Navegação reestruturada por Zonas de Contexto e Frequência de Uso:
 * 1. Meu Dia (Rotina operacional diária rápida)
 * 2. Meu Negócio & Gestão (CRM, Comercial, DRE e Contratos)
 * 3. Minha Contabilidade (Fiscal, Impostos, Sócios e Balanço)
 * 4. Patrimônio & Cofre (Holdings, Imóveis e Documentos Seguros)
 * 5. Suporte & Configurações (Atendimento, Planos e Ajustes)
 */
export const NAV: NavSection[] = [
  {
    title: 'Meu Dia',
    items: [
      { label: 'Visão Geral', href: '/cliente' },
      { label: 'Emissão de Notas (NFSe)', href: '/meu-negocio/notas' },
      { label: 'Contas a Pagar', href: '/meu-negocio/contas-a-pagar' },
      { label: 'Contas a Receber', href: '/meu-negocio/contas-a-receber' },
      { label: 'Conciliação Bancária', href: '/meu-negocio/conciliacao' },
    ],
  },
  {
    title: 'Meu Negócio',
    items: [
      { label: 'Hub Financeiro & DRE', href: '/meu-negocio/hub-financeiro' },
      { label: 'Clientes & CRM', href: '/meu-negocio/clientes' },
      { label: 'Relacionamento', href: '/relacionamento' },
      { label: 'Contratos & Assinaturas', href: '/meu-negocio/contratos' },
      { label: 'Propostas Comerciais', href: '/meu-negocio/propostas' },
      { label: 'Gestão Fiscal', href: '/meu-negocio/fiscal' },
    ],
  },
  {
    title: 'Minha Contabilidade',
    items: [
      { label: 'Guias de Impostos (DAS)', href: '/minha-contabilidade/guias' },
      { label: 'Termômetro Tributário', href: '/minha-contabilidade/termometro-tributario' },
      { label: 'Sócios & Pró-Labore', href: '/minha-contabilidade/socios' },
      { label: 'Distribuição de Lucros', href: '/minha-contabilidade/distribuicao-lucros' },
      { label: 'Departamento Pessoal', href: '/minha-contabilidade/departamento-pessoal' },
      { label: 'Relatórios & Balanço', href: '/meu-negocio/relatorios/fechamento' },
    ],
  },
  {
    title: 'Patrimônio & Cofre',
    items: [
      { label: 'Gestão Patrimonial', href: '/patrimonial' },
      { label: 'Cofre de Documentos', href: '/cofre' },
      { label: 'Arquivos Permanentes', href: '/minha-contabilidade/arquivos' },
    ],
  },
  {
    title: 'Sistema & Suporte',
    items: [
      { label: 'Atendimento & Suporte', href: '/suporte' },
      { label: 'Meu Plano & Assinatura', href: '/meu-plano' },
      { label: 'Serviços Adicionais', href: '/mais/servicos' },
      { label: 'Configurações', href: '/configuracoes' },
    ],
  },
];
