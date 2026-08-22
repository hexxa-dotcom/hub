import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Código de autorização não encontrado.' }, { status: 400 });
  }

  const cookieStore = await cookies();
  const expectedState = cookieStore.get('contaazul_oauth_state')?.value;
  cookieStore.delete('contaazul_oauth_state');
  if (!expectedState || !state || state !== expectedState) {
    return NextResponse.json({ error: 'State inválido ou expirado. Tente conectar novamente.' }, { status: 400 });
  }

  try {
    const ctx = await getTenantContext();

    // Verificar se já existe conexão para recuperar Client ID e Secret
    const [existing] = await withTenant(ctx.companyId, async (tx) => {
      return tx
        .select({ id: integrationCredential.id, secretRef: integrationCredential.secretRef })
        .from(integrationCredential)
        .where(
          and(
            eq(integrationCredential.companyId, ctx.companyId),
            eq(integrationCredential.provider, 'contaazul')
          )
        );
    });

    const secretData = existing?.secretRef as any;
    const CA_CLIENT_ID = secretData?.client_id;
    const CA_CLIENT_SECRET = secretData?.client_secret;

    if (!CA_CLIENT_ID || !CA_CLIENT_SECRET) {
      return NextResponse.json({ error: 'Credenciais da Conta Azul não configuradas.' }, { status: 500 });
    }

    const host = request.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/integrations/contaazul/callback`;

    // Trocar código pelo token
    const credentials = Buffer.from(`${CA_CLIENT_ID}:${CA_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch('https://api.contaazul.com/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('Erro ao autenticar na Conta Azul:', err);
      return NextResponse.json({ error: 'Falha ao autenticar na Conta Azul' }, { status: 400 });
    }

    const tokenData = await tokenResponse.json();
    
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const secretRef = {
      ...(secretData || {}),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
    };

    await withTenant(ctx.companyId, async (tx) => {
      if (existing) {
        return tx
          .update(integrationCredential)
          .set({ secretRef, active: true })
          .where(eq(integrationCredential.id, existing.id));
      } else {
        return tx.insert(integrationCredential).values({
          companyId: ctx.companyId,
          kind: 'ERP',
          provider: 'contaazul',
          secretRef,
          active: true,
        });
      }
    });

    return NextResponse.redirect(new URL('/configuracoes/integracoes/contaazul', request.url));
  } catch (error) {
    console.error('Erro no callback da Conta Azul:', error);
    return NextResponse.json({ error: 'Erro interno ao processar integração.' }, { status: 500 });
  }
}
