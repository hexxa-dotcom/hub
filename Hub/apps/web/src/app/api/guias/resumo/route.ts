import { NextResponse } from 'next/server';

// Seed compartilhado com HubGuias — mesma lógica de geração
function seedGuias() {
  const yr = new Date().getFullYear();
  return [
    { categoria: 'das', competencia: '03/2026', vencimento: `${yr}-04-22`, valor: 1100.00, status: 'vencida',  pagoEm: null },
    { categoria: 'das', competencia: '04/2026', vencimento: `${yr}-05-21`, valor: 1234.00, status: 'paga',     pagoEm: `${yr}-05-19` },
    { categoria: 'das', competencia: '05/2026', vencimento: `${yr}-06-20`, valor: 1456.00, status: 'paga',     pagoEm: `${yr}-06-18` },
    { categoria: 'das', competencia: '06/2026', vencimento: `${yr}-07-21`, valor: 1678.00, status: 'pendente', pagoEm: null },
    { categoria: 'darf', competencia: '1T/2026', vencimento: `${yr}-04-30`, valor: 445.00,  status: 'paga',     pagoEm: `${yr}-04-28` },
    { categoria: 'darf', competencia: '1T/2026', vencimento: `${yr}-04-30`, valor: 567.00,  status: 'paga',     pagoEm: `${yr}-04-28` },
    { categoria: 'darf', competencia: '05/2026', vencimento: `${yr}-06-20`, valor: 189.00,  status: 'paga',     pagoEm: `${yr}-06-17` },
    { categoria: 'iss',  competencia: '04/2026', vencimento: `${yr}-05-10`, valor: 234.00,  status: 'paga',     pagoEm: `${yr}-05-08` },
    { categoria: 'iss',  competencia: '05/2026', vencimento: `${yr}-06-10`, valor: 256.00,  status: 'paga',     pagoEm: `${yr}-06-09` },
    { categoria: 'iss',  competencia: '06/2026', vencimento: `${yr}-07-10`, valor: 267.00,  status: 'pendente', pagoEm: null },
    { categoria: 'parcelamento', competencia: '04/2026', vencimento: `${yr}-04-25`, valor: 432.00, status: 'paga',    pagoEm: `${yr}-04-23` },
    { categoria: 'parcelamento', competencia: '05/2026', vencimento: `${yr}-05-23`, valor: 432.00, status: 'paga',    pagoEm: `${yr}-05-21` },
    { categoria: 'parcelamento', competencia: '06/2026', vencimento: `${yr}-06-25`, valor: 432.00, status: 'vencida', pagoEm: null },
    { categoria: 'parcelamento', competencia: '07/2026', vencimento: `${yr}-07-25`, valor: 432.00, status: 'pendente',pagoEm: null },
    { categoria: 'fgts', competencia: '05/2026', vencimento: `${yr}-07-07`, valor: 560.00,  status: 'pendente', pagoEm: null },
  ];
}

export function GET() {
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  const guias = seedGuias();

  // DAS pago neste mês (pagoEm começa com currentMonth)
  const dasPago = guias
    .filter(g => g.categoria === 'das' && g.status === 'paga' && g.pagoEm?.startsWith(currentMonth))
    .reduce((s, g) => s + g.valor, 0);

  // Todos os impostos pagos neste mês (das + darf + iss)
  const totalImpostosPago = guias
    .filter(g => ['das','darf','iss'].includes(g.categoria) && g.status === 'paga' && g.pagoEm?.startsWith(currentMonth))
    .reduce((s, g) => s + g.valor, 0);

  return NextResponse.json({ dasPago, totalImpostosPago });
}
