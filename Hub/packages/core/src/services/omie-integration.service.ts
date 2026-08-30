import { getDb } from '@hexxa/db';
import { financialEntry, category, integrationCredential } from '@hexxa/db/schema';
import { eq, and } from 'drizzle-orm';

interface OmieSyncResult {
  success: boolean;
  omieReceiptId?: string;
  error?: string;
}

/**
 * Serviço responsável por sincronizar lançamentos financeiros com a Omie (ERP).
 *
 * AINDA NÃO FAZ A CHAMADA REAL À API DA OMIE — isso é um placeholder. Antes
 * desta correção, ele fingia sucesso (gerava um ID aleatório e retornava
 * `success: true`) tanto quando a integração não estava configurada quanto
 * quando "sincronizava" — a tela de Configurações chegava a dizer "os
 * pagamentos serão refletidos instantaneamente no seu balanço contábil",
 * o que nunca foi verdade. Até implementar a chamada HTTP real (Omie
 * FinancasAPI), este serviço deve sempre reportar que a sincronização NÃO
 * aconteceu, nunca fingir êxito.
 */
export class OmieIntegrationService {
  /**
   * Sincroniza um lançamento pago (PAID) do Hub para o Finanças da Omie,
   * garantindo que o balanço/DRE feche no sistema contábil.
   */
  public async syncPaidEntry(companyId: string, entryId: string): Promise<OmieSyncResult> {
    const db = getDb();

    // 1. Buscar o Lançamento — SEMPRE filtrado por companyId, nunca só por id
    // (sem isso, um entryId de outra empresa seria lido/"sincronizado" aqui).
    const [entry] = await db
      .select({
        amount: financialEntry.amount,
        dueDate: financialEntry.dueDate,
        paidAt: financialEntry.paidAt,
        description: financialEntry.description,
        type: financialEntry.type,
        categoryId: financialEntry.categoryId,
        bankAccountId: financialEntry.bankAccountId
      })
      .from(financialEntry)
      .where(and(eq(financialEntry.id, entryId), eq(financialEntry.companyId, companyId)));

    if (!entry) return { success: false, error: 'Lançamento não encontrado' };
    if (!entry.paidAt) return { success: false, error: 'Lançamento ainda não foi pago' };

    // 2. Buscar Categoria para Mapeamento de Plano de Contas (usado quando a
    // chamada HTTP real for implementada).
    let accCode = '9.9.99'; // Default genérico
    if (entry.categoryId) {
      const [cat] = await db.select({ accountingCode: category.accountingCode }).from(category).where(eq(category.id, entry.categoryId));
      if (cat?.accountingCode) accCode = cat.accountingCode;
    }

    const [cred] = await db
      .select({ active: integrationCredential.active })
      .from(integrationCredential)
      .where(and(eq(integrationCredential.companyId, companyId), eq(integrationCredential.provider, 'omie')));

    if (!cred?.active) {
      return { success: false, error: 'Integração com a Omie não está configurada para esta empresa.' };
    }

    console.log(`[Omie Sync] ${entry.type} de R$ ${entry.amount} (Cód Contábil: ${accCode}) pronto para sincronizar — chamada HTTP real ainda não implementada.`);
    return { success: false, error: 'Sincronização com a Omie ainda não implementada — a chamada à API real está pendente.' };
  }
}
