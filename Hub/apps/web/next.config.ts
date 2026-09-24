import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Pacotes do monorepo são TS puro — Next transpila no build.
  transpilePackages: ['@hexxa/core', '@hexxa/db', '@hexxa/integrations'],
  typedRoutes: true,
  // Contrato em PDF sobe por server action (até 3 MB; em base64 fica ~4 MB).
  // A Vercel aceita até 4,5 MB por requisição.
  experimental: { serverActions: { bodySizeLimit: '4mb' } },
  // Fixa a raiz do monorepo (evita inferência errada com múltiplos lockfiles).
  turbopack: {
    root: path.join(import.meta.dirname, '..', '..'),
  },
};

export default nextConfig;
