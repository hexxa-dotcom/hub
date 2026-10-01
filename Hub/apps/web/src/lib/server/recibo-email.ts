import 'server-only';
import type { TenantContext } from '@hexxa/core';
import { emitirRecibo } from './recibos';
import { enviarReciboEmitidoEmail } from './recibo-envio';

export interface SendReciboEmailResult {
  sent: boolean;
  reason?: string;
  message: string;
}

/** Compatibility for existing rental callers; uses the immutable issued PDF. */
export async function sendReciboEmailAction(ctx: TenantContext, entryId: string, destinatarioEmail?: string): Promise<SendReciboEmailResult> {
  try {
    const receipt = await emitirRecibo(ctx,entryId);
    const result = await enviarReciboEmitidoEmail(ctx,receipt.id,destinatarioEmail);
    return { sent: result.ok, message: result.message };
  } catch (err) {
    return { sent:false, reason:'issuance-error', message:err instanceof Error ? err.message : 'Não foi possível emitir o recibo.' };
  }
}
