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
      // Início, Panorama e Fechamento viraram vistas de /cliente (`?v=`), então
      // o menu aponta para a tela; a troca entre elas acontece no cabeçalho.
      { label: 'Início', href: '/cliente' },
    ],
  },
  {
    title: 'Contabilidade',
    items: [
      { label: 'Central de Guias', href: '/minha-contabilidade/guias' },
      { label: 'Termômetro Tributário', href: '/minha-contabilidade/termometro-tributario' },
      { label: 'Documentos da Empresa', href: '/minha-contabilidade/arquivos' },
      { label: 'Serviços Adicionais', href: '/mais/servicos' },
      // A fila de decisões do agente NÃO é um item de menu. Era "O que a IA
      // fez", e 98% dela era classificação de lançamento — assunto da
      // Conciliação, duas seções abaixo. O nome também falava do mecanismo em
      // vez do trabalho: o cliente não quer saber o que a IA fez, quer saber o
      // que falta ele conferir. Agora cada metade aparece onde o assunto mora
      // (ver FilaDeAcoes).
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
      // Sem adaptador ainda: a porta existe, nenhum implementador. O item fica
      // visível com o selo para o empresário saber que a lacuna tem solução
      // prevista, em vez de descobrir sozinho que o extrato não chega.
      { label: 'Open Finance', href: '/meu-negocio/open-finance', badge: 'Em breve' },
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
