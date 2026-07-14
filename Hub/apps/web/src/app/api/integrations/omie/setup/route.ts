import { NextResponse } from 'next/server';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { appKey, appSecret } = await request.json();

    if (!appKey || !appSecret) {
      return NextResponse.json({ error: 'App Key e App Secret são obrigatórios.' }, { status: 400 });
    }

    const supabase = await createRawClient();

    // Verifica se já existe config para o omie
    const { data: existing } = await supabase
      .from('integration_credential')
      .select('id, secret_ref')
      .eq('company_id', ctx.companyId)
      .eq('provider', 'omie')
      .single();

    const newSecretRef = {
      ...(existing?.secret_ref || {}),
      app_key: appKey,
      app_secret: appSecret,
    };

    if (existing) {
      await supabase
        .from('integration_credential')
        .update({ secret_ref: newSecretRef, active: true })
        .eq('id', existing.id);
    } else {
      await supabase.from('integration_credential').insert({
        company_id: ctx.companyId,
        kind: 'ERP',
        provider: 'omie',
        secret_ref: newSecretRef,
        active: true, // Omie não precisa de OAuth redirect, então já fica ativo
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro no setup do omie:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar credenciais.' }, { status: 500 });
  }
}
