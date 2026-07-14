/**
 * Servidor MCP do Hexx Hub Digital.
 *
 * Expõe o sistema para agentes de IA por meio de:
 *   • Resources → dados (read-only)   — ex.: dashboard, guias do mês
 *   • Tools     → ações (write)       — ex.: emitir NFSe, gerar reajuste
 *   • Prompts   → instruções padrão   — ex.: explicar termômetro tributário
 *
 * Reaproveita @hexxa/core (regras) e @hexxa/db (dados), então o agente faz
 * EXATAMENTE o que a UI faz — sem regra duplicada e respeitando RLS/linguagem.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerCompanyResources } from './resources/company.resources';
import { registerFinanceTools } from './tools/finance.tools';
import { registerAccountingPrompts } from './prompts/accounting.prompts';

const server = new McpServer({
  name: 'hexxa-hub',
  version: '0.1.0',
});

// Os três tipos de capacidade do MCP, padronizados.
registerCompanyResources(server);
registerFinanceTools(server);
registerAccountingPrompts(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Importante: nada de console.log em stdout no transporte stdio.
  console.error('[hexxa-mcp] servidor iniciado (stdio)');
}

main().catch((err) => {
  console.error('[hexxa-mcp] falha ao iniciar:', err);
  process.exit(1);
});
