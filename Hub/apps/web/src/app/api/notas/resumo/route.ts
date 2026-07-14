import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getTenantContext } from '@/lib/server/tenant';

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

  try {
    const { data, error } = await sb()
      .from('service_invoice')
      .select('amount, reference_month, status')
      .eq('company_id', (await getTenantContext()).companyId)
      .eq('status', 'ISSUED');

    if (error) throw error;

    // reference_month is stored as a date "YYYY-MM-01" or "YYYY-MM"
    const thisMonth = (data ?? []).filter((r: { reference_month: string }) => {
      const rm = String(r.reference_month ?? '').slice(0, 7);
      return rm === currentMonth;
    });

    const total = thisMonth.reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0);
    return NextResponse.json({ total, count: thisMonth.length, source: 'db' });
  } catch {
    // Fallback: return 0 so LucroCard still renders
    return NextResponse.json({ total: 0, count: 0, source: 'fallback' });
  }
}
