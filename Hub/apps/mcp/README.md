# @hexxa/mcp — Servidor Model Context Protocol

Expõe o Hexxa Hub para agentes de IA. Reaproveita `@hexxa/core`, `@hexxa/db` e
`@hexxa/integrations` — o agente faz o mesmo que a UI, sem regra duplicada.

```
src/
  index.ts                     # bootstrap (stdio); registra tudo
  resources/                   # DADOS (read-only)
    company.resources.ts       #   hexxa://company/{id}/dashboard, .../guias/{mes}
  tools/                       # AÇÕES (write)
    finance.tools.ts           #   emitir_nfse, prever_reajuste_aluguel
  prompts/                     # INSTRUÇÕES padronizadas
    accounting.prompts.ts      #   explicar_situacao_fiscal (carrega regras de linguagem)
```

## Rodar local
```bash
npm run dev -w @hexxa/mcp      # tsx watch (stdio)
```

## Conectar em um cliente MCP
```jsonc
{
  "mcpServers": {
    "hexxa-hub": { "command": "node", "args": ["apps/mcp/dist/index.js"] }
  }
}
```

## Padrões
- **Resource** = dado. URI `hexxa://company/{companyId}/...`.
- **Tool** = ação. Input validado com `zod`. Respeita RLS (recebe `companyId`).
- **Prompt** = instrução reutilizável; sempre carrega as regras de linguagem
  (valor / mês).
