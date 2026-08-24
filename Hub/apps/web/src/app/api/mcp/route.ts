import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { extractBearerToken, resolveApiToken } from '@/lib/server/api-auth';
import {
  getFaturamentoTempoReal,
  getResumoMesAtual,
  getResumoMes,
  getBussolaTributaria,
  listContas,
} from '@/lib/server/mcp-data';

export const dynamic = 'force-dynamic';

/**
 * Servidor MCP do Hexx Hub — expõe LEITURA dos dados financeiros pra
 * assistentes de IA externos (Claude, ChatGPT, etc.) autenticados por token
 * de API (gerado em Configurações → Integrações → Assistente de IA).
 *
 * Sem estado (stateless): cada requisição resolve o token, monta um
 * McpServer novo com as tools presas ao `companyId` daquele token, e
 * responde — não guarda sessão em memória (compatível com serverless).
 *
 * Nunca escreve nada: todas as tools abaixo só leem financial_entry,
 * business_contract, service_invoice etc. Emitir NFSe ou lançar despesa
 * continua exigindo a UI normal, de propósito.
 */

function buildServer(companyId: string): McpServer {
  const server = new McpServer({ name: 'hexxa-hub', version: '1.0.0' });

  server.registerTool(
    'faturamento_tempo_real',
    {
      title: 'Faturamento em tempo real',
      description: 'Quanto a empresa faturou hoje, nesta semana e neste mês, além do total a pagar nesta semana.',
      inputSchema: {},
    },
    async () => {
      const data = await getFaturamentoTempoReal(companyId);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    'resumo_mes_atual',
    {
      title: 'Resumo do mês atual',
      description:
        'Projeção do mês corrente: total a pagar/receber (com o que ainda está em aberto), impostos acumulados ' +
        '(deixando claro que o pagamento do DAS é só no mês seguinte), saldo projetado, contratos ativos e notas emitidas.',
      inputSchema: {},
    },
    async () => {
      const data = await getResumoMesAtual(companyId);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    'resumo_mes',
    {
      title: 'Resumo de um mês fechado',
      description:
        'Resumo completo de um mês específico já fechado: faturamento, despesas, lucro líquido, lucro distribuído ' +
        'aos sócios, impostos, contratos ativos, notas emitidas, novos clientes, admissões/desligamentos e taxa de inadimplência. ' +
        'Sem o parâmetro "mes", usa o mês anterior ao atual.',
      inputSchema: {
        mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Mês no formato AAAA-MM, ex.: "2026-07". Se omitido, usa o mês anterior.'),
      },
    },
    async ({ mes }) => {
      const data = await getResumoMes(companyId, mes);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    'bussola_tributaria',
    {
      title: 'Bússola Tributária (Simples Nacional)',
      description: 'Posição fiscal atual no Simples Nacional: anexo, faixa, alíquota, Fator R e quanto falta para a próxima faixa.',
      inputSchema: {},
    },
    async () => {
      const data = await getBussolaTributaria(companyId);
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.registerTool(
    'listar_contas',
    {
      title: 'Listar contas a pagar ou a receber',
      description: 'Lista lançamentos financeiros (contas a pagar ou a receber), com filtro opcional por status e mês.',
      inputSchema: {
        tipo: z.enum(['pagar', 'receber']).describe('"pagar" para contas a pagar, "receber" para contas a receber.'),
        status: z.enum(['aberto', 'vencido', 'pago']).optional().describe('Filtra pelo status do lançamento.'),
        mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Filtra pelo mês de referência, formato AAAA-MM.'),
      },
    },
    async ({ tipo, status, mes }) => {
      const data = await listContas(companyId, { tipo, status, mes });
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    }
  );

  return server;
}

export async function POST(req: Request) {
  const rawToken = extractBearerToken(req);

  if (!rawToken) {
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32001, message: 'Token de API ausente. Envie "Authorization: Bearer <token>".' }, id: null },
      { status: 401 }
    );
  }

  const auth = await resolveApiToken(rawToken);
  if (!auth) {
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32001, message: 'Token de API inválido ou revogado.' }, id: null },
      { status: 401 }
    );
  }

  const server = buildServer(auth.companyId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(req);
}

export async function GET() {
  return Response.json({ error: 'Este servidor MCP é stateless — use POST com mensagens JSON-RPC.' }, { status: 405 });
}

export async function DELETE() {
  return Response.json({ error: 'Este servidor MCP é stateless — não há sessão para encerrar.' }, { status: 405 });
}
