import {
  Receipt,
  TrendingDown,
  FileSignature,
  FileText,
  FileClock,
  Users,
  Landmark,
  type LucideIcon,
} from 'lucide-react';

export type QuickActionId =
  | 'nfse'
  | 'despesa'
  | 'contrato'
  | 'balanco'
  | 'proposta'
  | 'cliente'
  | 'das';

export type QuickActionDef = {
  id: QuickActionId;
  label: string;
  sub: string;
  href: string;
  icon: LucideIcon;
  /** Se true, abre num painel lateral (aba na direita) sem sair da tela em vez de navegar. */
  drawer?: boolean;
};

/** Catálogo de ações disponíveis pro menu "Ações Rápidas" — editável em Configurações > Ações Rápidas. */
export const QUICK_ACTIONS_CATALOG: QuickActionDef[] = [
  {
    id: 'nfse',
    label: 'Emitir Nota Fiscal (NFSe)',
    sub: 'Emissão rápida com 1 clique',
    href: '/meu-negocio/notas',
    icon: Receipt,
    drawer: true,
  },
  {
    id: 'despesa',
    label: 'Lançar Despesa / Saída',
    sub: 'Registrar pagamento ou compra',
    href: '/meu-negocio/hub-financeiro',
    icon: TrendingDown,
    drawer: true,
  },
  {
    id: 'contrato',
    label: 'Novo Contrato Digital',
    sub: 'Criar minuta com assinatura jurídica',
    href: '/meu-negocio/contratos',
    icon: FileSignature,
  },
  {
    id: 'balanco',
    label: 'Gerar Balanço / Fechamento',
    sub: 'Relatório contábil consolidado',
    href: '/meu-negocio/relatorios/fechamento',
    icon: FileText,
  },
  {
    id: 'proposta',
    label: 'Nova Proposta',
    sub: 'Enviar orçamento pra um cliente',
    href: '/meu-negocio/propostas',
    icon: FileClock,
  },
  {
    id: 'cliente',
    label: 'Novo Cliente',
    sub: 'Cadastrar tomador de serviço',
    href: '/relacionamento',
    icon: Users,
  },
  {
    id: 'das',
    label: 'Ver Guias de Imposto (DAS)',
    sub: 'Consultar e pagar guias pendentes',
    href: '/minha-contabilidade/guias',
    icon: Landmark,
  },
];

export const DEFAULT_QUICK_ACTIONS: QuickActionId[] = ['nfse', 'despesa', 'contrato', 'balanco'];

export const QUICK_ACTIONS_STORAGE_KEY = 'hexxa.quickActions.config';

export function readQuickActionsConfig(): QuickActionId[] {
  try {
    const stored = localStorage.getItem(QUICK_ACTIONS_STORAGE_KEY);
    if (!stored) return DEFAULT_QUICK_ACTIONS;
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_QUICK_ACTIONS;
    const valid = parsed.filter((id): id is QuickActionId =>
      QUICK_ACTIONS_CATALOG.some((a) => a.id === id)
    );
    return valid.length > 0 ? valid : DEFAULT_QUICK_ACTIONS;
  } catch {
    return DEFAULT_QUICK_ACTIONS;
  }
}
