import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

export interface RawBankTransaction {
  id: string; // ID da transação no extrato/Open Finance
  date: string; // ISO Date
  description: string; // Descrição suja do banco (ex: "PIX REC JOAO DA SILVA", "TARIFA BANCARIA", "PGTO TRIB DAS")
  amount: number; // Positivo (Receita) ou Negativo (Despesa)
}

export interface AccountingCategory {
  id: string;
  name: string; // ex: "Despesa com Software", "Receita de Serviços", "Impostos"
  kind: 'REVENUE' | 'EXPENSE';
}

export interface PendingFinancialEntry {
  id: string;
  amount: number;
  type: 'RECEIVABLE' | 'PAYABLE';
  dueDate: string; // ISO Date
}

export interface AIReconciliationResult {
  transactionId: string;
  suggestedCategoryId: string;
  confidenceScore: number;
  action: 'MATCH_EXISTING' | 'CREATE_NEW';
  matchedEntryId?: string; // Se ação for MATCH_EXISTING
  justification: string;
}

export class AIReconciliationService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Processa um lote de transações bancárias usando IA para categorizar 
   * e parear (match) com lançamentos financeiros pendentes.
   */
  public async reconcileBatch(
    transactions: RawBankTransaction[],
    categories: AccountingCategory[],
    pendingEntries: PendingFinancialEntry[]
  ): Promise<AIReconciliationResult[]> {
    if (transactions.length === 0) return [];

    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              transactionId: { type: SchemaType.STRING },
              suggestedCategoryId: { type: SchemaType.STRING },
              justification: { type: SchemaType.STRING, description: 'Breve explicação do porquê escolheu esta categoria' }
            },
            required: ['transactionId', 'suggestedCategoryId', 'justification']
          }
        }
      }
    });

    // 1. Prepara o Prompt de Categorização em Lote
    const categoriesContext = categories.map(c => `- ID: ${c.id} | Nome: ${c.name} | Tipo: ${c.kind}`).join('\n');
    const transactionsContext = transactions.map(t => `- ID: ${t.id} | Descrição: "${t.description}" | Valor: ${t.amount}`).join('\n');

    const prompt = `
      Você é um robô contador autônomo. Sua tarefa é analisar transações de extrato bancário 
      e classificá-las de acordo com o plano de contas da empresa.
      
      Plano de Contas (Categorias Disponíveis):
      ${categoriesContext}
      
      Transações Bancárias para Classificar:
      ${transactionsContext}
      
      Regras:
      1. Se o valor for positivo, escolha uma categoria do tipo REVENUE.
      2. Se o valor for negativo, escolha uma categoria do tipo EXPENSE.
      3. Analise as palavras-chave na descrição para encontrar a melhor categoria.
      
      Retorne o array JSON mapeando cada transactionId para o suggestedCategoryId correto.
    `;

    // 2. Chama a IA para classificar o lote
    let categorizedBatch: any[] = [];
    try {
      const response = await model.generateContent(prompt);
      categorizedBatch = JSON.parse(response.response.text());
    } catch (error) {
      console.error('Falha na classificação via IA:', error);
      throw new Error('Falha no motor de IA durante a conciliação.');
    }

    // 3. Lógica de Matching (Regras de Negócio Puras)
    const results: AIReconciliationResult[] = [];
    const usedPendingEntries = new Set<string>();
    const validCategoryIds = new Set(categories.map((c) => c.id));
    const DAY_MS = 24 * 60 * 60 * 1000;
    const MATCH_WINDOW_DAYS = 3; // mesma margem citada no comentário original

    for (const tx of transactions) {
      const aiCat = categorizedBatch.find((c: any) => c.transactionId === tx.id);
      if (!aiCat) continue; // IA pulou a transação (fallback manual necessário)
      // Nunca propagar uma categoria que a IA alucinou e não existe no plano
      // de contas enviado — cai pra CREATE_NEW em vez de aplicar uma
      // categoria inválida silenciosamente.
      if (!validCategoryIds.has(aiCat.suggestedCategoryId)) continue;

      const absAmount = Math.abs(tx.amount);
      const txType = tx.amount > 0 ? 'RECEIVABLE' : 'PAYABLE';
      const txDate = new Date(tx.date).getTime();

      // Entre os candidatos com mesmo valor e tipo, ainda não usados, dentro
      // de uma janela de ±3 dias da data da transação, escolhe o com
      // vencimento MAIS PRÓXIMO da data real — não o primeiro da lista.
      // Sem isso, duas contas de valor igual (ex: dois aluguéis de R$1.500)
      // podiam ser casadas com a errada.
      let matchedEntry: PendingFinancialEntry | undefined;
      let bestDiffDays = Infinity;
      for (const entry of pendingEntries) {
        if (usedPendingEntries.has(entry.id) || entry.type !== txType) continue;
        if (Math.abs(entry.amount - absAmount) >= 0.01) continue;
        const entryDate = new Date(entry.dueDate).getTime();
        if (Number.isNaN(entryDate) || Number.isNaN(txDate)) continue;
        const diffDays = Math.abs(entryDate - txDate) / DAY_MS;
        if (diffDays <= MATCH_WINDOW_DAYS && diffDays < bestDiffDays) {
          matchedEntry = entry;
          bestDiffDays = diffDays;
        }
      }

      if (matchedEntry) {
        usedPendingEntries.add(matchedEntry.id);
        results.push({
          transactionId: tx.id,
          suggestedCategoryId: aiCat.suggestedCategoryId,
          confidenceScore: 0.95, // Alto, pois bateu o valor e a IA classificou
          action: 'MATCH_EXISTING',
          matchedEntryId: matchedEntry.id,
          justification: `${aiCat.justification}. Encontrado lançamento pendente com valor exato.`
        });
      } else {
        results.push({
          transactionId: tx.id,
          suggestedCategoryId: aiCat.suggestedCategoryId,
          confidenceScore: 0.85, // Médio, nova despesa
          action: 'CREATE_NEW',
          justification: `${aiCat.justification}. Nenhum lançamento pendente compatível encontrado, será criado um novo registro pago.`
        });
      }
    }

    return results;
  }
}
