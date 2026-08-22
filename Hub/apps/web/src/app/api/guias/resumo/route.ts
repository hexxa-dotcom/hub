import { NextResponse } from 'next/server';
import { DrizzleTaxGuideRepository } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { categoriaDe } from '@/lib/guias';

export async function GET() {
  try {
    const ctx = await getTenantContext();
    const guias = await new DrizzleTaxGuideRepository().listAll(ctx);
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Sem coluna de "data de pagamento" no banco — usamos a competência
    // (referenceMonth) como aproximação de "pago referente a este mês".
    const dasPago = guias
      .filter(g => categoriaDe(g.taxName) === 'DAS' && g.status === 'PAID' && g.referenceMonth.startsWith(currentMonth))
      .reduce((s, g) => s + g.amount, 0);

    const totalImpostosPago = guias
      .filter(g => ['DAS', 'DARF', 'ISS'].includes(categoriaDe(g.taxName)) && g.status === 'PAID' && g.referenceMonth.startsWith(currentMonth))
      .reduce((s, g) => s + g.amount, 0);

    return NextResponse.json({ dasPago, totalImpostosPago });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro ao resumir guias' }, { status: 500 });
  }
}
