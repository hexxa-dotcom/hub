export type NavItem = { label: string; href: string };
export type NavSection = { title: string; items: NavItem[] };

/** List único e completo agrupado por correlação temática. */
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
      { label: 'Relacionamento & CRM', href: '/relacionamento' },
      { label: 'Propostas Comerciais', href: '/meu-negocio/propostas' },
      { label: 'Caixa de E-mail', href: '/meu-negocio/emails' },
    ],
  },
  {
    title: 'Gestão Comercial',
    items: [
      { label: 'Gestão de Contratos', href: '/meu-negocio/contratos' },
      { label: 'Gestão Fiscal', href: '/meu-negocio/fiscal' },
      { label: 'Notas Fiscais', href: '/meu-negocio/notas' },
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
      { label: 'Quanto Pago de Imposto', href: '/minha-contabilidade/termometro-tributario' },
      { label: 'Gestão de Patrimônio', href: '/patrimonial' },
      { label: 'Sócios', href: '/minha-contabilidade/socios' },
      { label: 'Distribuição de Lucros', href: '/minha-contabilidade/distribuicao-lucros' },
      { label: 'Departamento Pessoal', href: '/minha-contabilidade/departamento-pessoal' },
    ],
  },
  {
    title: 'Arquivos & Documentos',
    items: [
      { label: 'Arquivos Permanentes', href: '/minha-contabilidade/arquivos' },
    ],
  },
  {
    title: 'Suporte e Serviços',
    items: [
      { label: 'Meu Plano & Mensalidades', href: '/meu-plano' },
      { label: 'Serviços Adicionais', href: '/mais/servicos' },
      { label: 'Chat de Suporte & Atendimento', href: '/suporte' },
    ],
  },
  {
    title: 'Sistema',
    items: [
      { label: 'Ajustes do Sistema', href: '/configuracoes' },
    ],
  },
];
