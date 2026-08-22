import { NextResponse } from 'next/server';
import { withTenant } from '@hexxa/db/client';
import { emailAccount } from '@hexxa/db/schema';
import { eq } from 'drizzle-orm';
import { ImapFlow } from 'imapflow';
import { getTenantContext } from '@/lib/server/tenant';
import { encryptSecret } from '@/lib/server/secret-crypto';

export async function POST(req: Request) {
  try {
    // companyId sempre vem da sessão — nunca do corpo da requisição, para
    // não permitir que um cliente autenticado grave credenciais em outro tenant.
    const ctx = await getTenantContext();
    const companyId = ctx.companyId;

    const body = await req.json();
    const { imapHost, imapPort, smtpHost, smtpPort, emailAddress, password } = body;

    if (!imapHost || !emailAddress || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Test IMAP Connection
    const client = new ImapFlow({
      host: imapHost,
      port: Number(imapPort) || 993,
      secure: true,
      auth: {
        user: emailAddress,
        pass: password
      },
      logger: false // Disable verbose logging
    });

    try {
      await client.connect();
      await client.logout();
    } catch (err: any) {
      return NextResponse.json({ error: 'Invalid IMAP credentials', details: err.message }, { status: 401 });
    }

    // Save to database — senha sempre criptografada em repouso (AES-256-GCM).
    const encryptedPassword = encryptSecret(password);
    await withTenant(companyId, async (tx) => {
      // Upsert account
      const existing = await tx.select().from(emailAccount).where(eq(emailAccount.companyId, companyId)).execute();

      if (existing.length > 0) {
        await tx.update(emailAccount).set({
          imapHost,
          imapPort: String(imapPort || 993),
          smtpHost,
          smtpPort: String(smtpPort || 465),
          emailAddress,
          password: encryptedPassword,
          isActive: true
        }).where(eq(emailAccount.companyId, companyId)).execute();
      } else {
        await tx.insert(emailAccount).values({
          companyId,
          provider: 'IMAP',
          emailAddress,
          imapHost,
          imapPort: String(imapPort || 993),
          smtpHost,
          smtpPort: String(smtpPort || 465),
          username: emailAddress,
          password: encryptedPassword
        }).execute();
      }
    });

    return NextResponse.json({ success: true, message: 'Account connected successfully' });
  } catch (err: any) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
