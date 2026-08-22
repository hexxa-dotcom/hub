import { NextResponse } from 'next/server';
import { withTenant } from '@hexxa/db/client';
import { emailAccount, emailMessage, customer } from '@hexxa/db/schema';
import { eq, and } from 'drizzle-orm';
import nodemailer from 'nodemailer';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(req: Request) {
  try {
    // companyId sempre vem da sessão — nunca do corpo da requisição, para
    // não permitir que um cliente autenticado envie e-mail pela caixa de
    // outra empresa nem alcance um customer de outro tenant.
    const ctx = await getTenantContext();
    const companyId = ctx.companyId;

    const body = await req.json();
    const { customerId, subject, text, html } = body;

    if (!customerId || !subject || !text) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { account, cust } = await withTenant(companyId, async (tx) => {
      // 1. Obter a conta de e-mail do tenant
      const accountRows = await tx.select().from(emailAccount).where(eq(emailAccount.companyId, companyId)).execute();
      // 2. Obter o e-mail do cliente (customer) — restrito à mesma empresa
      const custRows = await tx
        .select()
        .from(customer)
        .where(and(eq(customer.id, customerId), eq(customer.companyId, companyId)))
        .execute();
      return { account: accountRows[0], cust: custRows[0] };
    });

    if (!account || !account.isActive || !account.smtpHost || !account.password) {
      return NextResponse.json({ error: 'No active email account found for this company' }, { status: 404 });
    }
    if (!cust || !cust.email) {
      return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 });
    }
    const custEmail = cust.email;

    // 3. Conectar via Nodemailer e enviar
    const transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: Number(account.smtpPort) || 465,
      secure: Number(account.smtpPort) === 465, 
      auth: {
        user: account.emailAddress,
        pass: account.password,
      },
    });

    const info = await transporter.sendMail({
      from: account.emailAddress,
      to: custEmail,
      subject: subject,
      text: text,
      html: html || text,
    });

    // 4. Salvar a mensagem enviada no cache interno
    await withTenant(companyId, async (tx) => {
      await tx.insert(emailMessage).values({
        companyId,
        accountId: account.id,
        customerId,
        remoteId: info.messageId || `local-${Date.now()}`,
        subject: subject,
        fromAddress: account.emailAddress,
        toAddress: custEmail,
        bodyText: text,
        sentAt: new Date(),
        isRead: true
      }).execute();
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (err: any) {
    return NextResponse.json({ error: 'Send error', details: err.message }, { status: 500 });
  }
}
