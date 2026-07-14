# @hexxa/db

Schema relacional (Drizzle) + cliente + migrações do **Hexxa Hub**.

> ⚠️ Banco **próprio e separado** do `hexxa-tasks`. Nunca aponte `DATABASE_URL` para o projeto Supabase do tasks.

## Estrutura

```
src/
  schema/
    _enums.ts        # todos os enums Postgres
    tenancy.ts       # company, app_user, membership   (multi-tenant)
    finance.ts       # camada financeira UNIFICADA
    service-ops.ts   # SERVICE: customer, contract, NFSe, assinatura
    accounting.ts    # guias, honorários, Departamento Pessoal
    patrimonial.ts   # HOLDING: imóveis, aluguéis, sócios
    platform.ts      # cofre, tickets, planos, integrações, notificações
  client.ts          # db + withTenant() (seta app.company_id p/ RLS)
migrations/
  0001_enable_rls.sql
```

## Fluxo de migração

```bash
# 1. Gera o SQL das tabelas a partir do schema TS
npm run db:generate -w @hexxa/db

# 2. Aplica no banco (usa DATABASE_URL)
npm run db:migrate -w @hexxa/db

# 3. Habilita RLS multi-tenant (rodar uma vez)
psql "$DATABASE_URL" -f migrations/0001_enable_rls.sql
```

## Multi-tenant
Toda query do app deve passar por `withTenant(companyId, tx => ...)`, que seta
`app.company_id` na sessão. As policies de RLS então filtram por `company_id`.
