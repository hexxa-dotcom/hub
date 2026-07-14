# 01 — Stack Tecnológica

> Decisão de stack para o Hexxa Hub, otimizada para **alta escalabilidade**, **API-First**, **multi-tenant** e **servidor MCP**. As escolhas foram alinhadas ao que já está validado no `hexxa-tasks` (Next.js + Tailwind v4 + Supabase) para reduzir curva de aprendizado e reuso de componentes.

## Visão geral

| Camada | Tecnologia | Por quê |
|---|---|---|
| **Front-end** | **Next.js (App Router, React Server Components) + TypeScript** | SSR/streaming, rotas por arquivo, edge-ready. Mesma base do `hexxa-tasks`. |
| **UI** | **Tailwind CSS v4 + Radix UI (shadcn) + Framer Motion + lucide-react** | Flat design + glassmorphism com tokens CSS; acessibilidade pronta. |
| **Estado (client)** | **Zustand + TanStack Query** | Zustand p/ UI local; Query p/ cache de dados do servidor/real-time. |
| **Back-end / API** | **Next.js Route Handlers + Server Actions** sobre uma **camada de domínio hexagonal** (`packages/core`) | API-First de verdade: a regra de negócio não vive na rota, vive em Services com portas (interfaces). |
| **ORM** | **Drizzle ORM** | TypeScript-first, type-safe, edge-compatible, SQL transparente — combina com o fluxo de migrações do Supabase e com RLS. |
| **Banco** | **PostgreSQL (Supabase) dedicado ao Hub** | Relacional, RLS para multi-tenant, Storage para o Cofre Digital, Realtime para o Dashboard. |
| **Servidor MCP** | **`@modelcontextprotocol/sdk` (TypeScript)** em app próprio | Expõe Resources/Tools/Prompts reaproveitando `packages/core` e `packages/db`. |
| **Jobs / Webhooks** | **Supabase Edge Functions (Deno)** + cron | Recebe callbacks de NFSe/assinatura/Open Finance e roda reajustes de aluguel. |
| **Monorepo** | **Turborepo + npm workspaces** | Compartilha domínio e schema entre Web e MCP; build incremental. |
| **Deploy** | **Vercel (web) + Supabase (dados/funcs)** | Mesmo pipeline já usado pela equipe. |

## Por que esta combinação atende aos requisitos

### SOLID / API-First
A regra de negócio fica em `packages/core` (entities + **services** + **ports**). As rotas Next.js e as ferramentas do MCP são apenas **entregadores** (delivery) que chamam os mesmos services. Integrações externas entram por **adapters** (`packages/integrations`) que implementam as **ports** — Inversão de Dependência (o "D" de SOLID) na prática.

### Multi-tenant
Toda tabela carrega `company_id`. O isolamento é garantido em duas camadas:
1. **Aplicação** — todo service recebe um `TenantContext` e filtra por `company_id`.
2. **Banco** — **Row Level Security (RLS)** do Postgres com policies por `company_id`, impedindo vazamento mesmo em caso de bug na aplicação.

### Pronto para MCP / agentes de IA
Como domínio e schema são pacotes compartilhados, o servidor MCP expõe exatamente as mesmas operações da API (sem duplicar regra). Um agente lê um *Resource* (`hexxa://company/{id}/dashboard`), executa uma *Tool* (`emitir_nfse`) e usa *Prompts* padronizados — tudo respeitando RLS e as regras de linguagem do produto.

### Escalabilidade
- RSC + streaming reduzem JS no cliente.
- Drizzle é leve e roda em edge/serverless (sem engine binário).
- Postgres + RLS escala verticalmente; leitura pesada do Dashboard pode usar *materialized views* e Supabase Realtime.
- Stateless: Web e MCP podem escalar horizontalmente.

## Dependências principais (resumo)

```
next, react, react-dom            # front-end
tailwindcss@4, @tailwindcss/postcss, framer-motion, lucide-react, @radix-ui/*
zustand, @tanstack/react-query
drizzle-orm, drizzle-kit, postgres # dados
@supabase/supabase-js, @supabase/ssr
@modelcontextprotocol/sdk, zod     # MCP + validação
date-fns                           # datas (mês de referência)
```

## Alternativas consideradas (e por que não)

- **Prisma** em vez de Drizzle — ótimo DX, mas runtime mais pesado e RLS menos natural; o fluxo de migração colide com o do Supabase. Drizzle mantém o SQL transparente.
- **NestJS** como back-end separado — excelente para SOLID, mas adiciona um serviço a operar. Como o domínio já está isolado em `packages/core`, ganhamos a mesma organização sem o overhead. *Caminho de evolução:* se a carga justificar, `packages/core` é portável para um serviço NestJS sem reescrever regra.
