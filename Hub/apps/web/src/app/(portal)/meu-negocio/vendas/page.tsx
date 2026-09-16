import { redirect } from 'next/navigation';

/**
 * Faturamento Avulso removido: por exigência legal, receita só pode ser
 * reconhecida com Nota Fiscal de Serviço emitida (ver /meu-negocio/notas) —
 * lançar "venda" direto no financeiro sem nota é o tipo de prática que expõe
 * a empresa a sonegação. Os lançamentos antigos (source='VENDA' em
 * financial_entry) continuam intactos e aparecem no Financeiro normalmente;
 * só a tela e a ação de CRIAR novos foram removidas.
 */
export default function Page() {
  redirect('/meu-negocio/notas');
}
