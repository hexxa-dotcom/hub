import { NextResponse } from 'next/server';
import { getDb, withTenant } from '@hexxa/db/client';
import { emailAccount, emailMessage, customer } from '@hexxa/db/schema';
import { eq, and } from 'drizzle-orm';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');
    const customerId = searchParams.get('customerId');

    if (!companyId || !customerId) {
      return NextResponse.json({ error: 'Missing companyId or customerId' }, { status: 400 });
    }

    const db = getDb();
    
    // 1. Obter a conta de e-mail do tenant
    const accountRows = await db.select().from(emailAccount).where(eq(emailAccount.companyId, companyId)).execute();
    const account = accountRows[0];
    if (!account || !account.isActive || !account.imapHost || !account.password) {
      return NextResponse.json({ error: 'No active email account found for this company' }, { status: 404 });
    }

    // 2. Obter o e-mail do cliente (customer)
    const custRows = await db.select().from(customer).where(eq(customer.id, customerId)).execute();
    const cust = custRows[0];
    if (!cust || !cust.email) {
      return NextResponse.json({ error: 'Customer has no email address' }, { status: 400 });
    }
    const custEmail = cust.email;

    // 3. Conectar ao IMAP e buscar (Lazy Sync)
    const client = new ImapFlow({
      host: account.imapHost,
      port: Number(account.imapPort) || 993,
      secure: true,
      auth: {
        user: account.emailAddress,
        pass: account.password
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
        // Checar se já existe no banco
        const exists = await db.select().from(emailMessage).where(and(eq(emailMessage.remoteId, String(uid)), eq(emailMessage.accountId, account.id))).execute();
        
        if (exists.length === 0) {
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

    // 4. Salvar novas mensagens no banco
    if (newMessages.length > 0) {
      await withTenant(companyId, async (tx) => {
        await tx.insert(emailMessage).values(newMessages).execute();
      });
    }

    // 5. Retornar todas as mensagens deste cliente do banco (ordenadas)
    const allMessages = await db.select()
      .from(emailMessage)
      .where(and(eq(emailMessage.customerId, customerId), eq(emailMessage.companyId, companyId)))
      .execute();

    return NextResponse.json({ messages: allMessages.sort((a, b) => new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime()) });
  } catch (err: any) {
    return NextResponse.json({ error: 'Sync error', details: err.message }, { status: 500 });
  }
}
