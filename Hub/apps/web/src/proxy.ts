import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

function isPublicRoute(pathname: string): boolean {
  const publicPrefixes = [
    '/planos',
    '/recursos',
    '/simulador',
    '/checkout',
    '/opengraph-image',
    '/icon',
    '/auth',
    '/api/leads',
    '/api/webhooks',
    '/api/docuseal/token',
    '/api/cron',
    // Autenticação própria por Bearer token (resolveApiToken), não por sessão
    // — usado por integrações externas (MCP, API v1). Sem isso aqui, o
    // middleware barraria a requisição antes do handler sequer ler o token.
    '/api/mcp',
    '/api/v1',
  ];
  if (pathname === '/') return true;
  return publicPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`));
}

const DEV_SKIP_AUTH = process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true';
// TEMPORÁRIO — rede de segurança da migração Clerk → Supabase Auth. Ver
// comentário em lib/server/tenant.ts. Desligar só depois do corte validado.
const SKIP_AUTH_TEMP = (process.env.SKIP_AUTH_TEMP ?? '').trim().toLowerCase() === 'true';

export default async function middleware(req: NextRequest) {
  if (SKIP_AUTH_TEMP) {
    if (isPublicRoute(req.nextUrl.pathname)) return NextResponse.next();
    // Sem sessão real, o mínimo pra não ficar 100% aberto: um código de 4
    // dígitos por área (cliente/contador), guardado num cookie. Ver
    // apps/web/src/app/auth/codigo/.
    const area: 'cliente' | 'contador' = req.nextUrl.pathname.startsWith('/contador') ? 'contador' : 'cliente';
    const cookieName = area === 'contador' ? 'hexx_access_contador' : 'hexx_access_cliente';
    const expected = area === 'contador' ? process.env.ACCESS_CODE_CONTADOR : process.env.ACCESS_CODE_CLIENTE;
    const got = req.cookies.get(cookieName)?.value;
    if (!expected || got !== expected) {
      const url = new URL('/auth/codigo', req.url);
      url.searchParams.set('area', area);
      url.searchParams.set('next', req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const { response, user } = await updateSession(req);

  if (DEV_SKIP_AUTH || isPublicRoute(req.nextUrl.pathname)) {
    return response;
  }

  if (!user) {
    const area: 'cliente' | 'contador' = req.nextUrl.pathname.startsWith('/contador') ? 'contador' : 'cliente';
    const url = new URL(area === 'contador' ? '/auth/login/contador' : '/auth/login', req.url);
    url.searchParams.set('next', req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
