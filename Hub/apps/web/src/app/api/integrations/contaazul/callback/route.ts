import { NextResponse } from 'next/server';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.json({ error: 'Código de autorização não encontrado.' }, { status: 400 });
  }

  try {
    const ctx = await getTenantContext();
    const supabase = await createRawClient();

    // Verificar se já existe conexão para recuperar Client ID e Secret
    const { data: existing } = await supabase
      .from('integration_credential')
      .select('id, secret_ref')
      .eq('company_id', ctx.companyId)
      .eq('provider', 'contaazul')
      .single();

    const CA_CLIENT_ID = existing?.secret_ref?.client_id;
    const CA_CLIENT_SECRET = existing?.secret_ref?.client_secret;

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
      ...(existing?.secret_ref || {}),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
    };

    if (existing) {
      await supabase
        .from('integration_credential')
        .update({ secret_ref: secretRef, active: true })
        .eq('id', existing.id);
    } else {
      await supabase.from('integration_credential').insert({
        company_id: ctx.companyId,
        kind: 'ERP',
        provider: 'contaazul',
        secret_ref: secretRef,
        active: true,
      });
    }

    return NextResponse.redirect(new URL('/configuracoes/integracoes/contaazul', request.url));
  } catch (error) {
    console.error('Erro no callback da Conta Azul:', error);
    return NextResponse.json({ error: 'Erro interno ao processar integração.' }, { status: 500 });
  }
}
