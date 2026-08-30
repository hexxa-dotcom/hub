import 'server-only';
import nodemailer from 'nodemailer';
import type { TenantContext } from '@hexxa/core';
import { withTenant, eq, and } from '@hexxa/db';
import { serviceInvoice, customer, emailAccount, emailMessage } from '@hexxa/db/schema';
import { resolveNfsePort } from './container';
import { decryptSecret } from './secret-crypto';
import { parseNfseXml } from './danfse';
import { renderDanfsePdf } from './danfse-pdf';

export interface SendNfseEmailResult {
  sent: boolean;
  reason?: string;
}

/**
 * Envia a NFSe (PDF do DANFSe anexado) para o e-mail do tomador, usando a
 * conta SMTP que o próprio tenant conectou em Configurações > Integrações.
 * Best-effort: chamado depois que a nota já está ISSUED — falhar aqui nunca
 * deve desfazer a emissão, só deixar de mandar o e-mail (motivo no retorno).
 */
export async function sendNfseEmailToCustomer(
  ctx: TenantContext,
  invoiceId: string,
): Promise<SendNfseEmailResult> {
  const { invoice, cust, account } = await withTenant(ctx.companyId, async (tx) => {
    const [inv] = await tx
      .select({
        id: serviceInvoice.id,
        customerId: serviceInvoice.customerId,
        providerProtocol: serviceInvoice.providerProtocol,
        nfseNumber: serviceInvoice.nfseNumber,
        amount: serviceInvoice.amount,
        serviceDescription: serviceInvoice.serviceDescription,
        status: serviceInvoice.status,
        providerMode: serviceInvoice.providerMode,
      })
      .from(serviceInvoice)
      .where(and(eq(serviceInvoice.id, invoiceId), eq(serviceInvoice.companyId, ctx.companyId)));

    const custRows = inv?.customerId
      ? await tx.select().from(customer).where(eq(customer.id, inv.customerId))
      : [];
    const accountRows = await tx.select().from(emailAccount).where(eq(emailAccount.companyId, ctx.companyId));
    return { invoice: inv, cust: custRows[0], account: accountRows[0] };
  });

  if (!invoice || invoice.status !== 'ISSUED') return { sent: false, reason: 'invoice-not-issued' };
  if (invoice.providerMode === 'mock') return { sent: false, reason: 'mock-invoice' };
  if (!invoice.providerProtocol) return { sent: false, reason: 'no-protocol' };
  if (!cust?.email) return { sent: false, reason: 'customer-no-email' };
  if (!account || !account.isActive || !account.smtpHost || !account.password) {
    return { sent: false, reason: 'no-email-account' };
  }

  const port = await resolveNfsePort(ctx);
  if (!port.download) return { sent: false, reason: 'adapter-no-download' };

  // O governo não expõe mais PDF via API pra terceiros — baixamos o XML
  // (documento fiscal real) e geramos nosso próprio layout de DANFSe.
  let pdf: Buffer;
  try {
    const xmlBuffer = await port.download(invoice.providerProtocol, 'xml');
    const data = parseNfseXml(xmlBuffer.toString('utf-8'), invoice.providerProtocol);
    pdf = await renderDanfsePdf(data);
  } catch (err) {
    return { sent: false, reason: `pdf-generation-failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  const transporter = nodemailer.createTransport({
    host: account.smtpHost,
    port: Number(account.smtpPort) || 465,
    secure: Number(account.smtpPort) === 465,
    auth: { user: account.emailAddress, pass: decryptSecret(account.password)! },
  });

  const numero = invoice.nfseNumber ?? invoice.providerProtocol;
  const subject = `NFS-e nº ${numero} — ${invoice.serviceDescription.slice(0, 60)}`;
  const text =
    `Olá, ${cust.name}!\n\n` +
    `Segue em anexo a Nota Fiscal de Serviço Eletrônica (NFS-e) nº ${numero}, ` +
    `no valor de R$ ${Number(invoice.amount).toFixed(2)}.\n\n` +
    `Referente a: ${invoice.serviceDescription}`;

  let info: { messageId?: string };
  try {
    info = await transporter.sendMail({
      from: account.emailAddress,
      to: cust.email,
      subject,
      text,
      attachments: [{ filename: `nfse_${numero}.pdf`, content: pdf, contentType: 'application/pdf' }],
    });
  } catch (err) {
    return { sent: false, reason: `smtp-send-failed: ${err instanceof Error ? err.message : String(err)}` };
  }

  await withTenant(ctx.companyId, async (tx) => {
    await tx.insert(emailMessage).values({
      companyId: ctx.companyId,
      accountId: account.id,
      customerId: cust.id,
      remoteId: info.messageId || `local-${Date.now()}`,
      subject,
      fromAddress: account.emailAddress,
      toAddress: cust.email!,
      bodyText: text,
      sentAt: new Date(),
      isRead: true,
    });
  });

  return { sent: true };
}
