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
    // Obter contexto da empresa logada
    const ctx = await getTenantContext();
    const supabase = await createRawClient();

    // Verificar se já existe conexão para o Bling
    const { data: existing } = await supabase
      .from('integration_credential')
      .select('id, secret_ref')
      .eq('company_id', ctx.companyId)
      .eq('provider', 'bling')
      .single();

    const BLING_CLIENT_ID = existing?.secret_ref?.client_id;
    const BLING_CLIENT_SECRET = existing?.secret_ref?.client_secret;

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
      ...(existing?.secret_ref || {}),
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: expiresAt.toISOString(),
    };

    if (existing) {
      // Atualizar
      await supabase
        .from('integration_credential')
        .update({ secret_ref: secretRef, active: true })
        .eq('id', existing.id);
    } else {
      // Inserir (na prática não entra aqui se já validou que existe o ID e Secret, mas por via das dúvidas)
      await supabase.from('integration_credential').insert({
        company_id: ctx.companyId,
        kind: 'ERP',
        provider: 'bling',
        secret_ref: secretRef,
        active: true,
      });
    }

    // Redirecionar de volta para a página de integrações
    return NextResponse.redirect(new URL('/configuracoes/integracoes', request.url));
  } catch (error) {
    console.error('Erro no callback do Bling:', error);
    return NextResponse.json({ error: 'Erro interno ao processar integração.' }, { status: 500 });
  }
}
