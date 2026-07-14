# Hexxa Hub

Portal do Cliente + Hub Operacional para **empresas de serviços** (pequeno/médio porte)
e **holdings patrimoniais**. Arquitetura API-First, multi-tenant, com servidor MCP para
agentes de IA.

> **Produto separado** do `hexxa-tasks`. Banco e projeto Supabase próprios.

## Stack (resumo)
Next.js (App Router) · Tailwind v4 · Drizzle ORM · PostgreSQL/Supabase (RLS multi-tenant) ·
`@modelcontextprotocol/sdk` · Turborepo. Detalhes em [`docs/01-stack.md`](docs/01-stack.md).

## Estrutura do monorepo

```
hexxa-hub/
├── docs/                      # 01-stack · 02-arquitetura · 03-banco-de-dados (ER)
├── apps/
│   ├── web/                   # ◀ PÁGINAS DO FRONT-END (Next.js)
│   │   └── src/app/(portal)/  #    dashboard, meu-negocio, minha-contabilidade,
│   │                          #    patrimonial, cofre, suporte, meu-plano
│   └── mcp/                   # ◀ ENDPOINTS DO SERVIDOR MCP
│       └── src/{resources,tools,prompts}/
├── packages/
│   ├── core/                  # DOMÍNIO (SOLID): entities, ports (interfaces), services, language
│   ├── integrations/          # ◀ ADAPTERS DAS INTEGRAÇÕES (nfse, signature, open-finance, econ-index)
│   └── db/                    # Drizzle schema + client + migrações (RLS)
├── turbo.json
└── package.json               # npm workspaces
```

Os **três pontos destacados** no briefing:

| O quê | Caminho |
|---|---|
| Páginas do Front-end | `apps/web/src/app/(portal)/` |
| Endpoints do servidor MCP | `apps/mcp/src/{resources,tools,prompts}/` |
| Adapters das integrações | `packages/integrations/src/{nfse,signature,open-finance}/` |

## Fluxo de dependência (hexagonal)
`apps/web` e `apps/mcp` → chamam **services** de `packages/core` → que dependem de **ports** →
implementadas por `packages/integrations` (APIs externas) e `packages/db` (Postgres).
O domínio nunca depende de fora. Detalhe em [`docs/02-arquitetura.md`](docs/02-arquitetura.md).

## Multi-tenant
`Company.type` (`SERVICE | HOLDING`) liga/desliga módulos. Camada financeira unificada;
operação de Serviços (NFSe/contratos) e de Holdings (imóveis/aluguéis) separadas.
Isolamento por `company_id` + **RLS** no Postgres.

## Regras de linguagem (CRÍTICO)
- Preço/honorário → **"valor"** (NUNCA "investimento").
- Período → **"mês"** (NUNCA "competência").

Centralizadas em `packages/core/src/language.ts`.

## Quick start
```bash
cd hexxa-hub
npm install                       # instala o workspace inteiro
cp .env.example .env.local        # configure o banco PRÓPRIO do Hub

# banco
npm run db:generate               # gera SQL do schema Drizzle
npm run db:migrate                # aplica no Postgres
psql "$DATABASE_URL" -f packages/db/migrations/0001_enable_rls.sql

# rodar
npm run dev                       # web (3001) + mcp via turbo
```

## Próximos passos sugeridos
1. `npm install` e subir o dev server para validar o scaffolding no browser.
2. Criar o projeto Supabase dedicado ao Hub e preencher `.env.local`.
3. Implementar o primeiro service end-to-end (sugestão: emissão de NFSe) ligando
   `web → core → integrations/nfse → db`.
