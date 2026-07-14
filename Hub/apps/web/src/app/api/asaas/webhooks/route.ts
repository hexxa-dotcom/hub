import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/asaas/webhooks
 * Recebe eventos do Asaas e atualiza o status de cobrança do cliente.
 *
 * Configure em Asaas > Minha Conta > Configurações > Notificações > Webhook:
 *   URL: https://seu-dominio.com/api/asaas/webhooks
 *   Token: valor de ASAAS_WEBHOOK_TOKEN
 *
 * Eventos mapeados:
 *   PAYMENT_RECEIVED / PAYMENT_CONFIRMED → cliente ativo
 *   PAYMENT_OVERDUE                       → cliente inadimplente
 *   PAYMENT_DELETED / SUBSCRIPTION_DELETED → cliente inativo
 */
export async function POST(req: NextRequest) {
  // Valida token do webhook
  const token = req.headers.get('asaas-access-token');
  if (!process.env.ASAAS_WEBHOOK_TOKEN || token !== process.env.ASAAS_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let event: { event: string; payment?: Record<string, unknown>; subscription?: Record<string, unknown> };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event: eventType, payment, subscription } = event;

  // externalReference guarda o ID interno do cliente na nossa plataforma
  const clienteId =
    (payment?.externalReference as string | undefined) ??
    (subscription?.externalReference as string | undefined);

  console.log(`[Asaas webhook] ${eventType} — clienteId: ${clienteId ?? 'n/a'}`);

  /*
   * Aqui você conecta ao Supabase para persistir o status.
   * Exemplo com Supabase (descomente quando o schema estiver pronto):
   *
   * import { createClient } from '@supabase/supabase-js';
   * const supabase = createClient(
   *   process.env.NEXT_PUBLIC_SUPABASE_URL!,
   *   process.env.SUPABASE_SERVICE_ROLE_KEY!,
   * );
   *
   * if (clienteId) {
   *   const statusMap: Record<string, string> = {
   *     PAYMENT_RECEIVED: 'ativo',
   *     PAYMENT_CONFIRMED: 'ativo',
   *     PAYMENT_OVERDUE: 'inadimplente',
   *     PAYMENT_DELETED: 'inativo',
   *     SUBSCRIPTION_DELETED: 'inativo',
   *   };
   *   const novoStatus = statusMap[eventType];
   *   if (novoStatus) {
   *     await supabase
   *       .from('empresa')
   *       .update({ status_cobranca: novoStatus })
   *       .eq('id', clienteId);
   *   }
   * }
   */

  return NextResponse.json({ received: true, event: eventType });
}
