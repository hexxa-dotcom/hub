import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getTenantContext } from '@/lib/server/tenant';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tipo = searchParams.get('tipo') || null;

  const { data, error } = await sb().rpc('get_lancamentos', {
    p_company_id: (await getTenantContext()).companyId,
    p_tipo: tipo,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { descricao, valor, vencimento, tipo, categoria, observacao } = body;

  if (!descricao || !valor || !vencimento || !tipo) {
    return NextResponse.json({ error: 'Campos obrigatórios ausentes.' }, { status: 400 });
  }

  const { data, error } = await sb().rpc('insert_lancamento', {
    p_company_id: (await getTenantContext()).companyId,
    p_tipo: tipo,
    p_descricao: descricao,
    p_valor: Number(valor),
    p_vencimento: vencimento,
    p_categoria: categoria ?? null,
    p_observacao: observacao ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
