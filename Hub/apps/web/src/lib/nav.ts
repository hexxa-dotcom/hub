export type NavItem = { label: string; href: string };
export type NavSection = { title: string; items: NavItem[] };

/** Menu único e completo agrupado por correlação temática. */
export const NAV: NavSection[] = [
  {
    title: 'Meu Negócio',
    items: [
      { label: 'Meu Negócio', href: '/dashboard' }
    ],
  },
  {
    title: 'Clientes & CRM',
    items: [
      { label: 'Clientes', href: '/meu-negocio/clientes' },
      { label: 'Relacionamento', href: '/relacionamento' },
      { label: 'Propostas', href: '/meu-negocio/propostas' },
      { label: 'Consulta CNPJ', href: '/meu-negocio/consulta-cnpj' },
    ],
  },
  {
    title: 'Gestão Comercial',
    items: [
      { label: 'Contratos', href: '/meu-negocio/contratos' },
      { label: 'Gestão Fiscal', href: '/meu-negocio/fiscal' },
      { label: 'Emitir NFS-e', href: '/meu-negocio/nfse' },
      { label: 'Notas Emitidas', href: '/meu-negocio/notas' },
    ],
  },
  {
    title: 'Hub Financeiro',
    items: [
      { label: 'Painel Financeiro', href: '/meu-negocio/hub-financeiro' },
      { label: 'Contas a Receber', href: '/meu-negocio/contas-a-receber' },
      { label: 'Contas a Pagar', href: '/meu-negocio/contas-a-pagar' },
      { label: 'Conciliação Bancária', href: '/meu-negocio/conciliacao' },
      { label: 'Relatório de Fechamento', href: '/meu-negocio/relatorios/fechamento' },
    ],
  },
  {
    title: 'Minha Contabilidade',
    items: [
      { label: 'Guias de Impostos', href: '/minha-contabilidade/guias' },
      { label: 'Termômetro Tributário', href: '/minha-contabilidade/termometro-tributario' },
      { label: 'Sócios', href: '/minha-contabilidade/socios' },
      { label: 'Distribuição de Lucros', href: '/minha-contabilidade/distribuicao-lucros' },
      { label: 'Honorários', href: '/minha-contabilidade/honorarios' },
      { label: 'Departamento Pessoal', href: '/minha-contabilidade/departamento-pessoal' },
    ],
  },
  {
    title: 'Arquivos & Patrimônio',
    items: [
      { label: 'Cofre Digital', href: '/cofre' },
      { label: 'Arquivos Permanentes', href: '/minha-contabilidade/arquivos' },
      { label: 'Gestão de Patrimônio', href: '/patrimonial' },
    ],
  },
  {
    title: 'Serviços',
    items: [
      { label: 'Serviços Adicionais', href: '/mais/servicos' },
      { label: 'Suporte', href: '/suporte' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Meu Plano', href: '/meu-plano' },
      { label: 'Configurações', href: '/configuracoes' },
    ],
  },
];
