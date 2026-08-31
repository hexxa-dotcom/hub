import { NextResponse } from 'next/server';
import { withTenant } from '@hexxa/db/client';
import { emailAccount, emailMessage, customer } from '@hexxa/db/schema';
import { eq, and } from 'drizzle-orm';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { getTenantContext } from '@/lib/server/tenant';
import { decryptSecret } from '@/lib/server/secret-crypto';

export async function GET(req: Request) {
  try {
    // companyId sempre vem da sessão — nunca de query param, para não deixar
    // um cliente autenticado ler a caixa de e-mail (e a senha IMAP em claro)
    // de outra empresa passando um companyId arbitrário na URL.
    const ctx = await getTenantContext();
    const companyId = ctx.companyId;

    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ error: 'Missing customerId' }, { status: 400 });
    }

    const { account, cust, existingRemoteIds } = await withTenant(companyId, async (tx) => {
      // Conta de e-mail e cliente são independentes entre si — só dependem
      // de companyId/customerId, já disponíveis — rodam em paralelo.
      const [accountRows, custRows] = await Promise.all([
        tx.select().from(emailAccount).where(eq(emailAccount.companyId, companyId)).execute(),
        tx
          .select()
          .from(customer)
          .where(and(eq(customer.id, customerId), eq(customer.companyId, companyId)))
          .execute(),
      ]);
      const acc = accountRows[0];
      const existing = acc
        ? await tx.select({ remoteId: emailMessage.remoteId }).from(emailMessage).where(eq(emailMessage.accountId, acc.id)).execute()
        : [];
      return { account: acc, cust: custRows[0], existingRemoteIds: new Set(existing.map((e) => e.remoteId)) };
    });

    if (!account || !account.isActive || !account.imapHost || !account.password) {
      return NextResponse.json({ error: 'No active email account found for this company' }, { status: 404 });
    }
    if (!cust || !cust.email) {
      return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 });
    }
    const custEmail = cust.email;
    const imapPassword = decryptSecret(account.password);

    // 3. Conectar ao IMAP e buscar (Lazy Sync)
    const client = new ImapFlow({
      host: account.imapHost,
      port: Number(account.imapPort) || 993,
      secure: true,
      auth: {
        user: account.emailAddress,
        pass: imapPassword!
      },
      logger: false
    });

    await client.connect();
    
    // Abrir a caixa de entrada
    await client.mailboxOpen('INBOX');

    // Buscar mensagens enviadas ou recebidas deste cliente
    const searchResult = await client.search({
      or: [
        { from: custEmail },
        { to: custEmail }
      ]
    });

    const newMessages: any[] = [];
    
    // Puxar apenas os IDs mais recentes para evitar timeout (max 10)
    const uidsToFetch = Array.isArray(searchResult) ? searchResult.slice(-10) : [];

    for (let uid of uidsToFetch) {
      const msg = await client.fetchOne(uid, { source: true, uid: true });
      if (msg && msg.source) {
        if (!existingRemoteIds.has(String(uid))) {
          const parsed = await simpleParser(msg.source);
          newMessages.push({
            companyId,
            accountId: account.id,
            customerId: customerId,
            remoteId: String(uid),
            subject: parsed.subject || '(Sem Assunto)',
            fromAddress: parsed.from?.value?.[0]?.address || 'unknown',
            toAddress: Array.isArray(parsed.to) 
              ? parsed.to[0]?.value?.[0]?.address || 'unknown' 
              : (parsed.to as any)?.value?.[0]?.address || 'unknown',
            bodyText: parsed.text || '',
            sentAt: parsed.date || new Date(),
            isRead: true
          });
        }
      }
    }

    await client.logout();

    // 4. Salvar novas mensagens e reler tudo deste cliente (ordenado)
    const allMessages = await withTenant(companyId, async (tx) => {
      if (newMessages.length > 0) {
        await tx.insert(emailMessage).values(newMessages).execute();
      }
      return tx
        .select()
        .from(emailMessage)
        .where(and(eq(emailMessage.customerId, customerId), eq(emailMessage.companyId, companyId)))
        .execute();
    });

    return NextResponse.json({ messages: allMessages.sort((a, b) => new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime()) });
  } catch (err: any) {
    return NextResponse.json({ error: 'Sync error', details: err.message }, { status: 500 });
  }
}
