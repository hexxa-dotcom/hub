export type NavItem = { label: string; href: string; badge?: string };
export type NavSection = { title: string; items: NavItem[] };

/**
 * Navegação organizada por pilar de negócio — nomes curtos (uma palavra
 * quando possível, no máximo "Gestão de X" quando precisar), mas sem
 * misturar assuntos diferentes na mesma seção (ex.: imposto é Contabilidade,
 * não Pessoas).
 * 1. Início (resumo de tudo — seção de 1 item só)
 * 2. Contabilidade (guias/impostos, parcelamentos, bússola tributária/Fator R,
 *    documentos da empresa, serviços adicionais)
 * 3. Financeiro (contas a pagar/receber, notas, conciliação, relatórios —
 *    balanço/DRE, fechamento mensal)
 * 4. Relacionamento (CRM, propostas, contratos)
 * 5. Gestão de Pessoas (sócios, colaboradores)
 * 6. Gestão do Patrimônio (imóveis)
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
      { label: 'Central de Guias', href: '/minha-contabilidade/guias' },
      { label: 'Termômetro Tributário', href: '/minha-contabilidade/termometro-tributario' },
      { label: 'Documentos da Empresa', href: '/minha-contabilidade/arquivos' },
      { label: 'Serviços Adicionais', href: '/mais/servicos' },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      // "Resumo" / "Pagar" / "Receber" eram 3 itens de menu pra UMA tela só
      // (contas-a-pagar e contas-a-receber são wrappers de hub-financeiro
      // com uma aba pré-selecionada) — colapsados aqui; as abas internas já
      // resolvem a navegação entre pagar/receber. As rotas /contas-a-pagar
      // e /contas-a-receber continuam existindo (usadas como link direto
      // pelos cards do Início), só saíram do menu lateral.
      { label: 'Financeiro', href: '/meu-negocio/hub-financeiro' },
      { label: 'Notas', href: '/meu-negocio/notas' },
      { label: 'Conciliação', href: '/meu-negocio/conciliacao' },
      { label: 'Relatórios', href: '/meu-negocio/relatorios' },
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
