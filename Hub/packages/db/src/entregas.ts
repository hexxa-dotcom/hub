import { sql } from 'drizzle-orm';
import type { DbHandle } from './client';

/**
 * ENTREGAS DE DOCUMENTOS DO ESCRITÓRIO AO CLIENTE — ver migration 0070.
 *
 * Toda entrega tem protocolo e linha do tempo. As funções recebem o handle
 * (banco ou transação) de quem chama: na área do contador é o banco direto;
 * na área do cliente, a transação com o tenant, que é o que o RLS exige.
 */

export type OrigemDaEntrega = 'CONTADOR' | 'ONEFLOW';
export type TipoDeDocumento = 'GUIA' | 'DECLARACAO' | 'CERTIDAO' | 'CONTRATO' | 'RECIBO' | 'OUTRO';
export type EventoDaEntrega =
  | 'ENVIADO'
  | 'EMAIL_ENVIADO'
  | 'EMAIL_NAO_ENVIADO'
  | 'VISUALIZADO'
  | 'BAIXADO'
  | 'CONFIRMADO'
  | 'ABERTO_PELO_CONTADOR';

type Tx = Pick<DbHandle, 'execute'>;

export async function registrarEventoDaEntrega(
  tx: Tx,
  deliveryId: string,
  companyId: string,
  tipo: EventoDaEntrega,
  detalhe: string | null = null,
): Promise<void> {
  await tx.execute(sql`
    INSERT INTO document_delivery_event (delivery_id, company_id, tipo, detalhe)
    VALUES (${deliveryId}, ${companyId}, ${tipo}, ${detalhe})
  `);
  // Os atalhos guardam a PRIMEIRA vez: é ela que prova que o cliente viu.
  if (tipo === 'VISUALIZADO' || tipo === 'BAIXADO') {
    await tx.execute(sql`
      UPDATE document_delivery SET visualizado_em = now()
       WHERE id = ${deliveryId} AND visualizado_em IS NULL
    `);
  }
  if (tipo === 'CONFIRMADO') {
    await tx.execute(sql`
      UPDATE document_delivery SET confirmado_em = now()
       WHERE id = ${deliveryId} AND confirmado_em IS NULL
    `);
  }
}

export interface NovaEntrega {
  companyId: string;
  origem: OrigemDaEntrega;
  tipo: TipoDeDocumento;
  titulo: string;
  descricao?: string | null;
  arquivo?: string | null;
  arquivoNome?: string | null;
  valor?: number | null;
  vencimento?: string | null;
  taxGuideId?: string | null;
  enviadoPor?: string | null;
}

export async function criarEntrega(tx: Tx, e: NovaEntrega): Promise<{ id: string; protocolo: string }> {
  const [linha] = (await tx.execute(sql`
    INSERT INTO document_delivery
      (company_id, origem, tipo, titulo, descricao, arquivo, arquivo_nome, valor, vencimento, tax_guide_id, enviado_por)
    VALUES
      (${e.companyId}, ${e.origem}, ${e.tipo}, ${e.titulo}, ${e.descricao ?? null}, ${e.arquivo ?? null},
       ${e.arquivoNome ?? null}, ${e.valor ?? null}, ${e.vencimento ?? null}, ${e.taxGuideId ?? null}, ${e.enviadoPor ?? null})
    RETURNING id, protocolo
  `)) as unknown as { id: string; protocolo: string }[];
  await registrarEventoDaEntrega(tx, linha!.id, e.companyId, 'ENVIADO');
  return linha!;
}

/**
 * Dá protocolo a uma guia oficial, uma vez só. Chamado quando a guia passa a
 * ser visível para o cliente — criada pela apuração do OneFlow, ou quando a
 * estimativa vira oficial.
 */
export async function garantirEntregaDaGuia(tx: Tx, companyId: string, taxGuideId: string): Promise<void> {
  const [guia] = (await tx.execute(sql`
    SELECT g.tax_name, g.amount, g.due_date, g.provisional,
           EXISTS (SELECT 1 FROM document_delivery d WHERE d.tax_guide_id = g.id) AS tem
      FROM tax_guide g WHERE g.id = ${taxGuideId}
  `)) as unknown as { tax_name: string; amount: string; due_date: string; provisional: boolean; tem: boolean }[];
  if (!guia || guia.provisional || guia.tem) return;
  await criarEntrega(tx, {
    companyId,
    origem: 'ONEFLOW',
    tipo: 'GUIA',
    titulo: guia.tax_name,
    valor: Number(guia.amount),
    vencimento: guia.due_date,
    taxGuideId,
  });
}
