import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // Pacotes do monorepo são TS puro — Next transpila no build.
  transpilePackages: ['@hexxa/core', '@hexxa/db', '@hexxa/integrations'],
  typedRoutes: true,
  // Fixa a raiz do monorepo (evita inferência errada com múltiplos lockfiles).
  turbopack: {
    root: path.join(import.meta.dirname, '..', '..'),
  },
  // Redireciona "/" -> "/dashboard" no roteador (sem page raiz).
  async redirects() {
    return [{ source: '/', destination: '/dashboard', permanent: false }];
  },
};

export default nextConfig;
