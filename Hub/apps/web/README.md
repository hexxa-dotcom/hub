# @hexxa/web — Front-end (Next.js)

Portal do Cliente do Hexxa Hub. Flat design + liquid glass nos cards de destaque.

## Estrutura de rotas (App Router)

```
src/app/
  layout.tsx                 # html raiz + globals.css (tema flat/glass)
  page.tsx                   # redireciona p/ /dashboard
  (portal)/
    layout.tsx               # shell: sidebar (menu filtrado por CompanyType)
    dashboard/               # Módulo 1 — cards glass, fluxo de caixa, termômetro
    meu-negocio/             # Módulo 2 — SERVICE
      nfse/  contratos/  contas-a-pagar/  contas-a-receber/  conciliacao/
    minha-contabilidade/     # Módulo 3 — comum
      guias/  departamento-pessoal/  honorarios/
    patrimonial/             # Módulo 4 — HOLDING
      imoveis/  alugueis/  faturamento/  rentabilidade/
    cofre/  suporte/  meu-plano/   # Módulo 5 — comum
```

## Design
- Tokens e utilitários `glass` / `card-flat` em `src/app/globals.css` (Tailwind v4).
- Cards do Dashboard em `src/components/ui/GlassCard.tsx`.
- Menu condicionado ao tipo da empresa em `src/lib/nav.ts` (`navFor(type)`).

## Linguagem (CRÍTICO)
Importe labels de `@hexxa/core/language` — nunca escreva "investimento" (use "valor")
nem "competência" (use "mês").

## Rodar
```bash
npm run dev -w @hexxa/web   # http://localhost:3001
```
