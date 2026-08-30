import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/',
  '/planos(.*)',
  '/recursos(.*)',
  '/simulador(.*)',
  '/checkout(.*)',
  '/opengraph-image(.*)',
  '/icon(.*)',
  '/auth(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/leads(.*)',
  '/api/webhooks(.*)',
  '/api/docuseal/token(.*)',
  '/api/cron(.*)',
  // Autenticação própria por Bearer token (resolveApiToken), não por sessão
  // Clerk — usado por integrações externas (MCP, API v1). Sem isso aqui, o
  // Clerk barra a requisição antes do handler sequer ler o token.
  '/api/mcp(.*)',
  '/api/v1(.*)',
  '/__clerk(.*)',
]);

const DEV_SKIP_AUTH = process.env.NODE_ENV !== 'production' && process.env.DEV_SKIP_AUTH === 'true';
// TEMPORÁRIO — ver comentário em lib/server/tenant.ts. Remover junto.
const SKIP_AUTH_TEMP = (process.env.SKIP_AUTH_TEMP ?? '').trim().toLowerCase() === 'true';

export default clerkMiddleware(
  async (auth, req) => {
    if (SKIP_AUTH_TEMP) {
      if (isPublicRoute(req)) return;
      // Sem Clerk, o mínimo pra não ficar 100% aberto: um código de 4
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
      return;
    }
    if (!DEV_SKIP_AUTH && !isPublicRoute(req)) {
      await auth.protect();
    }
  },
  {
    // O clerk-js instalado (v6, via @clerk/nextjs v7) chama /__clerk/*
    // same-origin por padrão — sem isso, essas chamadas caem no 404 do
    // Next.js e o login trava sem formulário.
    frontendApiProxy: {
      enabled: process.env.NODE_ENV === 'production',
    },
  },
);

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};
