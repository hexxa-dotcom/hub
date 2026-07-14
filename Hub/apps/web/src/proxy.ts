import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isPublicRoute = createRouteMatcher([
  '/auth(.*)',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/asaas/webhooks(.*)',
  '/api/webhooks(.*)',
  '/api/cron(.*)',
  '/__clerk(.*)',
]);

const isAllowedWithoutAuthTag = createRouteMatcher([
  '/onboarding(.*)',
  '/checkout(.*)',
  '/admin(.*)'
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
    '/__clerk/:path*',
  ],
};
