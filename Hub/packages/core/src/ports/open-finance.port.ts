/**
 * Port de Open Finance (agregação bancária). Implementações: Pluggy, Belvo...
 * (packages/integrations/open-finance). Alimenta a tela de Conciliação Bancária.
 */

export interface BankAccountRef {
  itemId: string;
  bankName: string;
  number: string;
  balance: number;
}

export interface ImportedTransaction {
  externalId: string;
  postedAt: string; // ISO date
  amount: number; // positivo = entrada, negativo = saída
  description: string;
}

export interface OpenFinancePort {
  /** Inicia o vínculo (retorna token/URL do widget de conexão). */
  createConnectToken(companyId: string): Promise<{ connectToken: string }>;
  listAccounts(itemId: string): Promise<BankAccountRef[]>;
  listTransactions(itemId: string, fromDate: string, toDate: string): Promise<ImportedTransaction[]>;
}
