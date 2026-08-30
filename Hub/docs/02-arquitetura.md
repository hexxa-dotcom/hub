# 02 — Arquitetura

> Arquitetura **hexagonal (Ports & Adapters)** dentro de um monorepo. O objetivo: a regra de negócio não conhece NFSe, Clicksign nem Pluggy — ela conhece **interfaces**. Trocar de fornecedor = trocar um adapter.

## Camadas

```
┌──────────────────────────────────────────────────────────────────┐
│  ENTREGA (delivery)                                                │
│  • apps/web    → páginas, Route Handlers, Server Actions           │
│  • apps/web/.../api/mcp → Tools (Model Context Protocol, só leitura)│
└───────────────┬────────────────────────────────────┬──────────────┘
                │  chamam services (nunca SQL direto) │
┌───────────────▼────────────────────────────────────▼──────────────┐
│  DOMÍNIO — packages/core                                           │
│  • entities (Company, Contract, Lease, TaxGuide, ...)              │
│  • services (regras: TaxThermometer, RentAdjustment, Billing)      │
│  • ports (interfaces: NfsePort, SignaturePort, OpenFinancePort,    │
│           CompanyRepository, ...)                                  │
└───────────────┬────────────────────────────────────┬──────────────┘
        implementa ports                       usa repositórios
┌───────────────▼──────────────┐  ┌───────────────────▼──────────────┐
│  ADAPTERS — packages/integr.  │  │  PERSISTÊNCIA — packages/db       │
│  • nfse/ (Emissor Nacional)   │  │  • Drizzle schema + client        │
│  • signature/   (Clicksign)   │  │  • repositórios (impl. das ports) │
│  • open-finance/(Pluggy)      │  │  • migrações + RLS                │
└───────────────────────────────┘  └───────────────────────────────────┘
```

### Regra de ouro
- **Domínio (`core`) não importa nada de `web`, `mcp`, `integrations` ou `db`.** Ele só define interfaces (ports).
- **`integrations` e `db` implementam** as ports do `core`.
- **`web` e `mcp`** montam tudo (injeção de dependência) e expõem.

Isso é o **D**ependency Inversion do SOLID: o de fora depende do de dentro, nunca o contrário.

## Os três pontos que o briefing pediu para destacar

| O quê | Onde fica |
|---|---|
| **Páginas do Front-end** | [`apps/web/src/app/(portal)/`](../apps/web/src/app/(portal)) — uma pasta por módulo |
| **Endpoints do servidor MCP** | [`apps/mcp/src/{resources,tools,prompts}/`](../apps/mcp/src) |
| **Adapters das integrações externas** | [`packages/integrations/src/{nfse,signature,open-finance}/`](../packages/integrations/src) |

## Multi-tenant: SERVICE vs HOLDING

O tenant é a entidade **`Company`** com um enum **`CompanyType`**:

- **`SERVICE`** → habilita o módulo *Meu Negócio* (NFSe, contratos de recorrência, contas a pagar/receber, conciliação).
- **`HOLDING`** → habilita o módulo *Gestão Patrimonial* (imóveis, contratos de aluguel, faturamento imobiliário, rentabilidade do sócio).

Os módulos **Dashboard**, **Minha Contabilidade**, **Cofre Digital**, **Suporte** e **Meu Plano** são comuns aos dois tipos.

A **camada financeira é unificada** (`bank_account`, `financial_entry`, `bank_transaction`, conciliação): tanto uma NFSe (serviço) quanto um aluguel (holding) geram lançamentos na mesma estrutura → o Dashboard e a conciliação funcionam igual para ambos. O que muda é a **origem operacional** do lançamento.

## Fluxo de uma operação (ex.: emitir NFSe)

```
web/Server Action  ─►  core: ServiceInvoiceService.emit(input, ctx)
                          │  1. valida regra + tenant
                          │  2. chama port NfsePort.issue(...)
                          ▼
              integrations/nfse/GovNfseAdapter ──mTLS──► Emissor Nacional (gov.br)
                          │  3. retorna protocolo
                          ▼
              core grava via ServiceInvoiceRepository (port)
                          ▼
              db/DrizzleServiceInvoiceRepository (RLS por company_id)
                          ▼
        cria financial_entry (RECEIVABLE) na camada financeira unificada
```

O **MCP** chama exatamente o mesmo `ServiceInvoiceService.emit(...)` a partir de uma *Tool* — zero duplicação de regra.

## Regras de linguagem (CRÍTICO — aplicadas em todo o produto)
- Preço/honorário → **"valor"** (NUNCA "investimento").
- Período → **"mês"** (NUNCA "competência").

Centralizadas em [`packages/core/src/language.ts`](../packages/core/src/language.ts) e usadas como fonte única para labels da UI e textos do MCP.
