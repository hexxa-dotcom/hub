import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();

    const [cred] = await withTenant(ctx.companyId, async (tx) => {
      return tx
        .select({ secretRef: integrationCredential.secretRef })
        .from(integrationCredential)
        .where(
          and(
            eq(integrationCredential.companyId, ctx.companyId),
            eq(integrationCredential.provider, 'bling')
          )
        );
    });

    const BLING_CLIENT_ID = (cred?.secretRef as any)?.client_id;

    if (!BLING_CLIENT_ID) {
      return NextResponse.json({ error: 'Configuração do Bling não encontrada. Configure as chaves primeiro.' }, { status: 400 });
    }

    // State aleatório e criptograficamente forte, guardado num cookie httpOnly
    // e conferido no callback — protege contra CSRF no fluxo OAuth (um
    // "state" gerado mas nunca verificado não protege nada).
    const state = randomBytes(24).toString('hex');

    const authUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', BLING_CLIENT_ID);
    authUrl.searchParams.append('state', state);

    // Redireciona o usuário para a página de permissões do Bling
    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set('bling_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('Erro no authorize do Bling:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
