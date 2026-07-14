import { NextResponse } from 'next/server';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { clientId, clientSecret } = await request.json();

    if (!clientId || !clientSecret) {
      return NextResponse.json({ error: 'Client ID e Secret são obrigatórios.' }, { status: 400 });
    }

    const supabase = await createRawClient();

    // Verifica se já existe config para o bling
    const { data: existing } = await supabase
      .from('integration_credential')
      .select('id, secret_ref')
      .eq('company_id', ctx.companyId)
      .eq('provider', 'bling')
      .single();

    const newSecretRef = {
      ...(existing?.secret_ref || {}),
      client_id: clientId,
      client_secret: clientSecret,
    };

    if (existing) {
      await supabase
        .from('integration_credential')
        .update({ secret_ref: newSecretRef })
        .eq('id', existing.id);
    } else {
      await supabase.from('integration_credential').insert({
        company_id: ctx.companyId,
        kind: 'ERP',
        provider: 'bling',
        secret_ref: newSecretRef,
        active: false, // Só fica active após o callback de auth
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro no setup do bling:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar credenciais.' }, { status: 500 });
  }
}
