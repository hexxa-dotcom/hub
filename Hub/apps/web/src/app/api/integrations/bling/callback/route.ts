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
  const expectedState = cookieStore.get('bling_oauth_state')?.value;
  cookieStore.delete('bling_oauth_state');
  if (!expectedState || !state || state !== expectedState) {
    return NextResponse.json({ error: 'State inválido ou expirado. Tente conectar novamente.' }, { status: 400 });
  }

  try {
    // Obter contexto da empresa logada
    const ctx = await getTenantContext();

    // Verificar se já existe conexão para o Bling
    const [existing] = await withTenant(ctx.companyId, async (tx) => {
      return tx
        .select({ id: integrationCredential.id, secretRef: integrationCredential.secretRef })
        .from(integrationCredential)
        .where(
          and(
            eq(integrationCredential.companyId, ctx.companyId),
            eq(integrationCredential.provider, 'bling')
          )
        );
    });

    const secretData = existing?.secretRef as any;
    const BLING_CLIENT_ID = secretData?.client_id;
    const BLING_CLIENT_SECRET = secretData?.client_secret;

    if (!BLING_CLIENT_ID || !BLING_CLIENT_SECRET) {
      return NextResponse.json({ error: 'Credenciais do Bling não configuradas.' }, { status: 500 });
    }

    // Trocar código pelo token
    const credentials = Buffer.from(`${BLING_CLIENT_ID}:${BLING_CLIENT_SECRET}`).toString('base64');
    
    const tokenResponse = await fetch('https://www.bling.com.br/Api/v3/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code
      })
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error('Erro ao autenticar no Bling:', err);
      return NextResponse.json({ error: 'Falha ao autenticar no Bling' }, { status: 400 });
    }

    const tokenData = await tokenResponse.json();
    // tokenData = { access_token, expires_in, refresh_token, scope, token_type }

    // Calcular expiração
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
        // Atualizar
        return tx
          .update(integrationCredential)
          .set({ secretRef, active: true })
          .where(eq(integrationCredential.id, existing.id));
      } else {
        // Inserir (na prática não entra aqui se já validou que existe o ID e Secret, mas por via das dúvidas)
        return tx.insert(integrationCredential).values({
          companyId: ctx.companyId,
          kind: 'ERP',
          provider: 'bling',
          secretRef,
          active: true,
        });
      }
    });

    // Redirecionar de volta para a página de integrações
    return NextResponse.redirect(new URL('/configuracoes/integracoes', request.url));
  } catch (error) {
    console.error('Erro no callback do Bling:', error);
    return NextResponse.json({ error: 'Erro interno ao processar integração.' }, { status: 500 });
  }
}
