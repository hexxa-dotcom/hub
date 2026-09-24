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
      // O cadastro da empresa vivia em Suporte > Configurações, três cliques
      // longe e sob um título que ninguém associa a "a minha empresa". É a
      // primeira coisa que alguém procura ao entrar.
      { label: 'Minha Empresa', href: '/minha-empresa' },
    ],
  },
  {
    title: 'Contabilidade',
    items: [
      { label: 'Central de Guias', href: '/minha-contabilidade/guias' },
      { label: 'Bússola Tributária', href: '/minha-contabilidade/termometro-tributario' },
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
      { label: 'Meu mês', href: '/meu-negocio/hub-financeiro' },
      { label: 'Notas', href: '/meu-negocio/notas' },
      // Open Finance saiu do menu (2026-09-24): não há provedor contratado. O
      // aviso "conexão com o banco em breve" fica na aba Extrato do Meu mês,
      // ao lado do subir extrato, que é o caminho que funciona hoje. A página
      // /meu-negocio/open-finance continua existindo para quando voltar.
      { label: 'Relatórios', href: '/meu-negocio/relatorios' },
    ],
  },
  {
    title: 'Relacionamento',
    items: [
      { label: 'Clientes', href: '/relacionamento' },
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
    title: 'Patrimônio',
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
