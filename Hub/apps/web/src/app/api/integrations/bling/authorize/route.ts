import { NextResponse } from 'next/server';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export async function GET(request: Request) {
  try {
    const ctx = await getTenantContext();
    const supabase = await createRawClient();

    const { data: cred } = await supabase
      .from('integration_credential')
      .select('secret_ref')
      .eq('company_id', ctx.companyId)
      .eq('provider', 'bling')
      .single();

    const BLING_CLIENT_ID = cred?.secret_ref?.client_id;

    if (!BLING_CLIENT_ID) {
      return NextResponse.json({ error: 'Configuração do Bling não encontrada. Configure as chaves primeiro.' }, { status: 400 });
    }

    // Define um state para segurança
    const state = Math.random().toString(36).substring(7);
    
    const authUrl = new URL('https://www.bling.com.br/Api/v3/oauth/authorize');
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('client_id', BLING_CLIENT_ID);
    authUrl.searchParams.append('state', state);
    
    // Redireciona o usuário para a página de permissões do Bling
    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error('Erro no authorize do Bling:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
