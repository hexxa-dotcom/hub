import { NextResponse } from 'next/server';

/** Limpa o cookie de código de acesso (cliente ou contador). Rota pública. */
export async function GET(req: Request) {
  const area = new URL(req.url).searchParams.get('area') === 'contador' ? 'contador' : 'cliente';
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(area === 'contador' ? 'hexx_access_contador' : 'hexx_access_cliente');
  return res;
}
