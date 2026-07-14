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
      .eq('provider', 'contaazul')
      .single();

    const CA_CLIENT_ID = cred?.secret_ref?.client_id;

    if (!CA_CLIENT_ID) {
      return NextResponse.json({ error: 'Configuração da Conta Azul não encontrada. Configure as chaves primeiro.' }, { status: 400 });
    }

    const state = Math.random().toString(36).substring(7);
    
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
    
    return NextResponse.redirect(authUrl.toString());
  } catch (err) {
    console.error('Erro no authorize da Conta Azul:', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
