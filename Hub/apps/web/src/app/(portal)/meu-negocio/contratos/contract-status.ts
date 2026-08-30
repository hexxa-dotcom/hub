import type { ContractRow } from './actions';

export const STATUS_LABEL: Record<ContractRow['status'], string> = {
  AGUARDANDO_ASSINATURA: 'Aguardando Assinatura',
  ATIVO: 'Ativo',
  CANCELADO: 'Cancelado',
  RECUSADO: 'Recusado',
  EXPIRADO: 'Expirado',
};

export const STATUS_CLASS: Record<ContractRow['status'], string> = {
  AGUARDANDO_ASSINATURA: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  ATIVO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  CANCELADO: 'bg-black/10 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]',
  RECUSADO: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  EXPIRADO: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
};
