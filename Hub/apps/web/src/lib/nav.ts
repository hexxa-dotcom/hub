export type NavItem = { label: string; href: string; badge?: string };
export type NavSection = { title: string; items: NavItem[] };

/**
 * Navegação organizada por pilar de negócio — nomes curtos (uma palavra
 * quando possível, no máximo "Gestão de X" quando precisar), mas sem
 * misturar assuntos diferentes na mesma seção (ex.: imposto é Contabilidade,
 * não Pessoas).
 * 1. Início (resumo de tudo — seção de 1 item só)
 * 2. Contabilidade (guias/impostos, parcelamentos, bússola tributária/Fator
 *    R, balanço/DRE, serviços adicionais)
 * 3. Financeiro (resumo/DRE, contas a pagar/receber, notas, conciliação)
 * 4. Relacionamento (CRM, propostas, contratos)
 * 5. Gestão de Pessoas (sócios, colaboradores)
 * 6. Gestão do Patrimônio (imóveis, arquivos)
 * 7. Suporte (atendimento, plano, ajustes)
 */
export const NAV: NavSection[] = [
  {
    title: 'Início',
    items: [
      { label: 'Início', href: '/cliente' },
      { label: 'Resumo do Mês', href: '/cliente/resumo-mes' },
    ],
  },
  {
    title: 'Contabilidade',
    items: [
      { label: 'Guias e Impostos', href: '/minha-contabilidade/guias' },
      { label: 'Bússola', href: '/minha-contabilidade/termometro-tributario' },
      { label: 'Balanço e DRE', href: '/meu-negocio/relatorios/balanco' },
      { label: 'Serviços Adicionais', href: '/mais/servicos' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { label: 'Resumo', href: '/meu-negocio/hub-financeiro' },
      { label: 'Notas', href: '/meu-negocio/notas' },
      { label: 'Faturamento Avulso', href: '/meu-negocio/vendas' },
      { label: 'Pagar', href: '/meu-negocio/contas-a-pagar' },
      { label: 'Receber', href: '/meu-negocio/contas-a-receber' },
      { label: 'Conciliação', href: '/meu-negocio/conciliacao', badge: 'Em breve' },
    ],
  },
  {
    title: 'Relacionamento',
    items: [
      { label: 'CRM', href: '/relacionamento' },
      { label: 'Propostas', href: '/meu-negocio/propostas' },
      { label: 'Contratos', href: '/meu-negocio/contratos' },
    ],
  },
  {
    title: 'Gestão de Pessoas',
    items: [
      { label: 'Sócios', href: '/minha-contabilidade/socios' },
      { label: 'Colaboradores', href: '/minha-contabilidade/departamento-pessoal' },
    ],
  },
  {
    title: 'Gestão do Patrimônio',
    items: [
      { label: 'Imóveis', href: '/patrimonial' },
      { label: 'Arquivos', href: '/minha-contabilidade/arquivos' },
    ],
  },
  {
    title: 'Suporte',
    items: [
      { label: 'Atendimento', href: '/suporte' },
      { label: 'Plano', href: '/meu-plano' },
      { label: 'Configurações', href: '/configuracoes' },
    ],
  },
];
