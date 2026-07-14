import { NextResponse } from 'next/server';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext();
    const { apiToken } = await request.json();

    if (!apiToken) {
      return NextResponse.json({ error: 'O Token de API é obrigatório.' }, { status: 400 });
    }

    const supabase = await createRawClient();

    // Verifica se já existe config para o nibo
    const { data: existing } = await supabase
      .from('integration_credential')
      .select('id, secret_ref')
      .eq('company_id', ctx.companyId)
      .eq('provider', 'nibo')
      .single();

    const newSecretRef = {
      ...(existing?.secret_ref || {}),
      api_token: apiToken,
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
        provider: 'nibo',
        secret_ref: newSecretRef,
        active: true, // Nibo usa token direto, já fica ativo
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Erro no setup do Nibo:', err);
    return NextResponse.json({ error: 'Erro interno ao salvar credenciais.' }, { status: 500 });
  }
}
