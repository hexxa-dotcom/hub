import * as fs from 'fs';
// Manual dotenv parsing to avoid module loading issues in scripts
const env = fs.readFileSync('./apps/web/.env.local', 'utf-8');
env.split('\n').forEach(line => {
  const match = line.match(/^([^#\s][^=]+)="?(.*?)"?$/);
  if (match && match[1]) process.env[match[1]] = match[2];
});
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY ausente em apps/web/.env.local');
  process.exit(1);
}

import { AIReconciliationService } from '../../../packages/core/src/services/ai-reconciliation.service';
import type { RawBankTransaction, AccountingCategory, PendingFinancialEntry } from '../../../packages/core/src/services/ai-reconciliation.service';

async function runTest() {
  console.log('--- Iniciando Teste de Razão Contábil Autônomo (AI Reconciliation) ---\n');

  const reconciliationService = new AIReconciliationService(process.env.GEMINI_API_KEY!);

  // Mock do Plano de Contas da Empresa
  const categories: AccountingCategory[] = [
    { id: 'cat-001', name: 'Impostos e Tributos', kind: 'EXPENSE' },
    { id: 'cat-002', name: 'Serviços Prestados', kind: 'REVENUE' },
    { id: 'cat-003', name: 'Software e Nuvem', kind: 'EXPENSE' },
    { id: 'cat-004', name: 'Pró-labore', kind: 'EXPENSE' },
    { id: 'cat-005', name: 'Distribuição de Lucros', kind: 'EXPENSE' },
  ];

  // Lançamentos pendentes no sistema (ex: Contas a pagar/receber registradas mas não pagas)
  const pendingEntries: PendingFinancialEntry[] = [
    { id: 'entry-101', amount: 5000.00, type: 'RECEIVABLE', dueDate: '2026-08-28' }, // NF de serviço emitida
    { id: 'entry-102', amount: 850.50, type: 'PAYABLE', dueDate: '2026-08-20' },  // DAS Pendente
  ];

  // Extrato Bruto do Banco (OFX)
  const bankTransactions: RawBankTransaction[] = [
    { id: 'tx-01', date: '2026-08-28', description: 'PIX TRANSFERENCIA CLI* EMPRESA ABC', amount: 5000.00 },
    { id: 'tx-02', date: '2026-08-20', description: 'PAG TO TRIBUTO DAS SIMPLES NAC', amount: -850.50 },
    { id: 'tx-03', date: '2026-08-21', description: 'PGTO CARTAO CRED - AWS AMAZON CLOUD', amount: -125.00 },
  ];

  console.log('📦 Extrato Bancário recebido (Bruto):');
  console.table(bankTransactions);

  console.log('\n🤖 AI Categorization Engine processando o lote...\n');
  const results = await reconciliationService.reconcileBatch(bankTransactions, categories, pendingEntries);

  console.log('✅ Resultado da Conciliação Inteligente:');
  for (const res of results) {
    const tx = bankTransactions.find(t => t.id === res.transactionId)!;
    const catName = categories.find(c => c.id === res.suggestedCategoryId)?.name || 'Desconhecida';
    
    console.log(`\n💳 Transação: ${tx.description} (R$ ${tx.amount})`);
    console.log(`   🏷️ Categoria IA: ${catName}`);
    console.log(`   ⚙️ Ação: ${res.action === 'MATCH_EXISTING' ? `Baixa Automática (Entry ID: ${res.matchedEntryId})` : 'Criar Novo Lançamento (Despesa Nova)'}`);
    console.log(`   📝 Justificativa IA: ${res.justification}`);
  }

}

runTest().catch(console.error);
