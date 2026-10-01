import 'server-only';
import nodemailer from 'nodemailer';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { obterRecibo } from './recibos';
import { decryptSecret } from './secret-crypto';

export async function enviarReciboEmitidoEmail(ctx: TenantContext, id: string, recipient?: string, idempotencyKey?: string) {
  if (process.env.NODE_ENV !== 'production' && process.env.RECEIPT_ALLOW_EMAIL !== 'true') {
    return { ok: false, message: 'Na prévia local, o envio real de e-mail está desativado.' };
  }
  const r = await obterRecibo(ctx, id);
  if (!r || r.canceled_at) return { ok: false, message: 'Recibo não encontrado ou cancelado.' };
  const email = (recipient || r.data.locatario.email || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Informe um e-mail válido para enviar.' };
  const [account] = await withTenant(ctx.companyId, tx => tx.execute(sql`SELECT * FROM email_account WHERE company_id = ${ctx.companyId} AND is_active LIMIT 1`));
  if (!account?.smtp_host || !account.password) return { ok: false, message: 'Conecte uma conta de e-mail em Configurações > Integrações.' };
  const [delivery] = await withTenant(ctx.companyId, tx => tx.execute(sql`INSERT INTO receipt_delivery(company_id,receipt_id,recipient,status,idempotency_key)
    VALUES (${ctx.companyId},${id}::uuid,${email},'ENVIANDO',${idempotencyKey || null}) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id::text`));
  if (!delivery) {
    const [previous] = await withTenant(ctx.companyId, tx => tx.execute(sql`SELECT status FROM receipt_delivery WHERE company_id = ${ctx.companyId} AND idempotency_key = ${idempotencyKey || null}`));
    return previous?.status === 'ENVIADO'
      ? { ok: true, message: 'Recibo já enviado por este agendamento.' }
      : { ok: false, message: 'Existe uma tentativa de e-mail que precisa ser conferida. Envie manualmente pela tela Recibos.' };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: String(account.smtp_host), port: Number(account.smtp_port) || 465,
      secure: Number(account.smtp_port || 465) === 465,
      auth: { user: String(account.email_address), pass: decryptSecret(String(account.password))! },
    });
    await transporter.sendMail({ from: String(account.email_address), to: email,
      subject: `Recibo de pagamento ${r.number} — ${r.data.locador.nome}`,
      text: `Olá, ${r.data.locatario.nome}!\n\nSegue em anexo o recibo do pagamento de ${r.data.descricao}, referente a ${r.data.mesReferencia}.\n\n${r.data.locador.nome}`,
      attachments: [{ filename: `${r.number}.pdf`, content: Buffer.from(r.pdf_base64, 'base64'), contentType: 'application/pdf' }],
    });
    await withTenant(ctx.companyId, tx => tx.execute(sql`UPDATE receipt_delivery SET status = 'ENVIADO' WHERE id = ${String(delivery!.id)}::uuid AND company_id = ${ctx.companyId}`));
    return { ok: true, message: `Recibo enviado para ${email}.` };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao enviar e-mail.';
    await withTenant(ctx.companyId, tx => tx.execute(sql`UPDATE receipt_delivery SET status = 'ERRO', error = ${message} WHERE id = ${String(delivery!.id)}::uuid AND company_id = ${ctx.companyId}`));
    return { ok: false, message: 'Não foi possível enviar. O recibo continua disponível para baixar e tentar novamente.' };
  }
}
