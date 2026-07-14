# @hexxa/integrations — Adapters de integrações externas

> **Este é o ponto único onde o sistema toca APIs de terceiros.** Cada adapter
> implementa uma *port* definida em `@hexxa/core/ports`. O domínio nunca importa
> daqui — recebe a interface por injeção (Dependency Inversion / SOLID).

```
src/
  nfse/          → NfsePort         (Focus NFe; Mock p/ dev)
  signature/     → SignaturePort    (Clicksign)
  open-finance/  → OpenFinancePort  (Pluggy) — alimenta a Conciliação Bancária
  econ-index/    → EconomicIndexPort (Banco Central IPCA/IGP-M) — reajuste de aluguel
  index.ts       → factories makeNfsePort()/makeSignaturePort()/... (escolhem o fornecedor por env)
```

## Como trocar de fornecedor
1. Crie `src/nfse/plugnotas.adapter.ts implements NfsePort`.
2. Adicione o caso em `makeNfsePort()`.
3. Pronto — nenhuma regra de negócio muda.

## Webhooks
Os callbacks (NFSe autorizada, documento assinado, transação importada) chegam
em **Supabase Edge Functions** e atualizam o domínio via os mesmos services.
