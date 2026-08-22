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
            eq(integrationCredential.provider, 'contaazul')
          )
        );
    });

    const CA_CLIENT_ID = (cred?.secretRef as any)?.client_id;

    if (!CA_CLIENT_ID) {
      return NextResponse.json({ error: 'Configuração da Conta Azul não encontrada. Configure as chaves primeiro.' }, { status: 400 });
    }

    // State aleatório e criptograficamente forte, guardado num cookie httpOnly
    // e conferido no callback — protege contra CSRF no fluxo OAuth.
    const state = randomBytes(24).toString('hex');

    // Constrói a URL para Conta Azul
    const authUrl = new URL('https://api.contaazul.com/auth/authorize');

    // A Conta Azul pede que o redirect_uri seja enviado na autorização (deve ser idêntico ao cadastrado no portal deles)
    const host = request.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/integrations/contaazul/callback`;

    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('client_id', CA_CLIENT_ID);
    authUrl.searchParams.append('scope', 'sales'); // Escopos básicos
    authUrl.searchParams.append('state', state);

    const response = NextResponse.redirect(authUrl.toString());
    response.cookies.set('contaazul_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 600,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('Erro no authorize da Conta Azul:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
