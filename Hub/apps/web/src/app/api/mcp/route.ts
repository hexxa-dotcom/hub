import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { extractBearerToken, resolveApiToken, type ApiTokenAuth } from '@/lib/server/api-auth';
import {
  getFaturamentoTempoReal,
  getResumoMesAtual,
  getResumoMes,
  getBussolaTributaria,
  listContas,
  searchCompanies,
  resolveTargetCompany,
  listContratos,
  listGuiasImpostos,
  getRelatorioInadimplencia,
  getPanoramaCarteira,
  getPrevisaoLucroDistribuicao,
} from '@/lib/server/mcp-data';
import {
  classificarLancamento,
  conciliarTransacao,
  listarFilaAprovacao,
  listarFilaRevisao,
  historicoDoLancamento,
  decidirAcao,
} from '@/lib/server/agent-tools';

export const dynamic = 'force-dynamic';

/**
 * Servidor MCP do Hexx Hub — expõe LEITURA dos dados financeiros pra
 * assistentes de IA externos (Claude, ChatGPT, etc.) autenticados por token
 * de API (gerado em Configurações → Integrações → Assistente de IA).
 *
 * Suporta dois modos de operação:
 * 1. Cliente Normal (scope 'read' ou 'write'): tools ficam presas ao companyId do token.
 * 2. Contador/Admin (scope 'admin'): ganha a tool `buscar_clientes` e pode passar
 *    o argumento `cliente` (nome ou CNPJ) em qualquer tool financeira para consultar
 *    clientes específicos da carteira.
 *
 * FERRAMENTAS DE ESCRITA (scope 'write' ou 'admin') — as mãos do agente.
 *
 * Todas passam por `agent-tools.ts`, que por sua vez passa por `propor`: a
 * régua de autonomia classifica a ação, a confiança é medida a partir do
 * histórico real e a justificativa fica gravada. Nenhuma ferramenta escreve
 * direto no domínio, mesmo quando seria mais curto.
 *
 * Uma escrita barrada por falta de aprovação NÃO é erro: a ferramenta devolve
 * `situacao: "aguardando_aprovacao"` e o agente precisa contar isso ao
 * usuário, em vez de procurar outro caminho para o mesmo efeito.
 *
 * Escrita só é exposta em modo de empresa única. Em `admin`, o argumento
 * `cliente` faz a leitura saltar entre empresas da carteira — e uma escrita
 * que salta de empresa por um parâmetro de texto é exatamente o tipo de coisa
 * que grava na contabilidade errada.
 */

function buildServer(auth: ApiTokenAuth): McpServer {
  const server = new McpServer({ name: 'hexxa-hub', version: '1.0.0' });
  const isAdmin = auth.scope === 'admin';

  if (isAdmin) {
    server.registerTool(
      'buscar_clientes',
      {
        title: 'Buscar ou listar clientes',
        description:
          'Lista ou pesquisa clientes/empresas cadastrados no Hub por nome, razão social ou CNPJ. ' +
          'Use para identificar qual empresa consultar ou para listar as empresas ativas da carteira.',
        inputSchema: {
          termo: z.string().optional().describe('Termo de busca (nome, razão social ou dígitos do CNPJ). Se omitido, lista todas as empresas cadastradas.'),
        },
      },
      async ({ termo }) => {
        const data = await searchCompanies(termo);
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
    );

    server.registerTool(
      'panorama_carteira',
      {
        title: 'Panorama geral de toda a carteira de clientes',
        description:
          'Visão macro e consolidada do escritório: faturamento total somado da carteira no mês atual, inadimplência consolidada, despesas somadas e resumo individual de cada cliente cadastrado.',
        inputSchema: {},
      },
      async () => {
        const data = await getPanoramaCarteira();
        return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
      }
    );
  }

  server.registerTool(
    'contratos_ativos',
    {
      title: 'Contratos e receitas/despesas recorrentes',
      description:
        'Lista os contratos comerciais vigentes da empresa, com valores mensais (MRR), vigência e dias de vencimento. ' +
        (isAdmin ? 'Como administrador, você pode informar o cliente por nome ou CNPJ.' : ''),
      inputSchema: {
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente. Disponível em modo Administrador/Contador.'),
      },
    },
    async ({ cliente }) => {
      const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
      const data = await listContratos(target.id);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            empresa: { id: target.id, nome: target.tradeName || target.legalName, cnpj: target.cnpj, tipo: target.type },
            ...data,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'guias_impostos',
    {
      title: 'Guias de impostos (DAS, INSS, ISS)',
      description:
        'Consulta as guias tributárias geradas para a empresa, seus status (pago, aberto, vencido) e se possuem código Pix disponível. ' +
        (isAdmin ? 'Como administrador, você pode informar o cliente por nome ou CNPJ.' : ''),
      inputSchema: {
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente. Disponível em modo Administrador/Contador.'),
        status: z.enum(['aberto', 'pago', 'vencido']).optional().describe('Filtra guias pelo status.'),
        mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Mês de referência, formato AAAA-MM (ex: 2026-07).'),
      },
    },
    async ({ cliente, status, mes }) => {
      const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
      const data = await listGuiasImpostos(target.id, { status, mes });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            empresa: { id: target.id, nome: target.tradeName || target.legalName, cnpj: target.cnpj, tipo: target.type },
            ...data,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'relatorio_inadimplencia',
    {
      title: 'Relatório de inadimplência e cobranças em atraso',
      description:
        'Lista contas a receber vencidas e não pagas, calculando dias de atraso e valor total inadimplente. ' +
        (isAdmin ? 'Se não informar o cliente, gera o relatório global de inadimplência de toda a carteira.' : ''),
      inputSchema: {
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente para filtrar por uma empresa específica.'),
      },
    },
    async ({ cliente }) => {
      let targetCompanyId: string | undefined;
      if (cliente) {
        const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
        targetCompanyId = target.id;
      } else if (!isAdmin) {
        targetCompanyId = auth.companyId;
      }

      const data = await getRelatorioInadimplencia(targetCompanyId, isAdmin);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'previsao_lucro_distribuicao',
    {
      title: 'Previsão de lucro e distribuição aos sócios',
      description:
        'Calcula quanto a empresa tem de lucro contábil projetado disponível para distribuir aos sócios neste mês ' +
        'e no acumulado do ano, confrontando receitas, despesas e retiradas já efetuadas. ' +
        (isAdmin ? 'Como administrador, você pode informar o cliente por nome ou CNPJ.' : ''),
      inputSchema: {
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente. Disponível em modo Administrador/Contador.'),
      },
    },
    async ({ cliente }) => {
      const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
      const data = await getPrevisaoLucroDistribuicao(target.id);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            empresa: { id: target.id, nome: target.tradeName || target.legalName, cnpj: target.cnpj, tipo: target.type },
            ...data,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'faturamento_tempo_real',
    {
      title: 'Faturamento em tempo real',
      description:
        'Quanto a empresa faturou hoje, nesta semana e neste mês, além do total a pagar nesta semana. ' +
        (isAdmin ? 'Como administrador, você pode informar o cliente por nome ou CNPJ.' : ''),
      inputSchema: {
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente. Disponível em modo Administrador/Contador.'),
      },
    },
    async ({ cliente }) => {
      const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
      const data = await getFaturamentoTempoReal(target.id);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            empresa: { id: target.id, nome: target.tradeName || target.legalName, cnpj: target.cnpj, tipo: target.type },
            ...data,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'resumo_mes_atual',
    {
      title: 'Resumo do mês atual',
      description:
        'Projeção do mês corrente: total a pagar/receber (com o que ainda está em aberto), impostos acumulados ' +
        '(deixando claro que o pagamento do DAS é só no mês seguinte), saldo projetado, contratos ativos e notas emitidas. ' +
        (isAdmin ? 'Como administrador, você pode informar o cliente por nome ou CNPJ.' : ''),
      inputSchema: {
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente. Disponível em modo Administrador/Contador.'),
      },
    },
    async ({ cliente }) => {
      const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
      const data = await getResumoMesAtual(target.id);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            empresa: { id: target.id, nome: target.tradeName || target.legalName, cnpj: target.cnpj, tipo: target.type },
            ...data,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'resumo_mes',
    {
      title: 'Resumo de um mês fechado',
      description:
        'Resumo completo de um mês específico já fechado: faturamento, despesas, lucro líquido, lucro distribuído ' +
        'aos sócios, impostos, contratos ativos, notas emitidas, novos clientes, admissões/desligamentos e taxa de inadimplência. ' +
        'Sem o parâmetro "mes", usa o mês anterior ao atual. ' +
        (isAdmin ? 'Como administrador, você pode informar o cliente por nome ou CNPJ.' : ''),
      inputSchema: {
        mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Mês no formato AAAA-MM, ex.: "2026-07". Se omitido, usa o mês anterior.'),
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente. Disponível em modo Administrador/Contador.'),
      },
    },
    async ({ mes, cliente }) => {
      const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
      const data = await getResumoMes(target.id, mes);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            empresa: { id: target.id, nome: target.tradeName || target.legalName, cnpj: target.cnpj, tipo: target.type },
            ...data,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'bussola_tributaria',
    {
      title: 'Bússola Tributária (Simples Nacional)',
      description:
        'Posição fiscal atual no Simples Nacional: anexo, faixa, alíquota, Fator R e quanto falta para a próxima faixa. ' +
        (isAdmin ? 'Como administrador, você pode informar o cliente por nome ou CNPJ.' : ''),
      inputSchema: {
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente. Disponível em modo Administrador/Contador.'),
      },
    },
    async ({ cliente }) => {
      const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
      const data = await getBussolaTributaria(target.id);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            empresa: { id: target.id, nome: target.tradeName || target.legalName, cnpj: target.cnpj, tipo: target.type },
            ...data,
          }, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    'listar_contas',
    {
      title: 'Listar contas a pagar ou a receber',
      description:
        'Lista lançamentos financeiros (contas a pagar ou a receber), com filtro opcional por status e mês. ' +
        (isAdmin ? 'Como administrador, você pode informar o cliente por nome ou CNPJ.' : ''),
      inputSchema: {
        tipo: z.enum(['pagar', 'receber']).describe('"pagar" para contas a pagar, "receber" para contas a receber.'),
        status: z.enum(['aberto', 'vencido', 'pago']).optional().describe('Filtra pelo status do lançamento.'),
        mes: z.string().regex(/^\d{4}-\d{2}$/).optional().describe('Filtra pelo mês de referência, formato AAAA-MM.'),
        cliente: z.string().optional().describe('Nome, razão social ou CNPJ do cliente. Disponível em modo Administrador/Contador.'),
      },
    },
    async ({ tipo, status, mes, cliente }) => {
      const target = await resolveTargetCompany(cliente, auth.companyId, isAdmin);
      const data = await listContas(target.id, { tipo, status, mes });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            empresa: { id: target.id, nome: target.tradeName || target.legalName, cnpj: target.cnpj, tipo: target.type },
            ...data,
          }, null, 2),
        }],
      };
    }
  );

  /* ── Escrita ──────────────────────────────────────────────────────────── */

  const podeEscrever = auth.scope === 'write' || isAdmin;

  if (podeEscrever) {
    server.registerTool(
      'classificar_lancamento',
      {
        title: 'Classificar um lançamento numa categoria contábil',
        description:
          'Atribui a categoria contábil a um lançamento financeiro. É a ação de maior valor do sistema: ' +
          'lançamento sem categoria vai para a conta "Despesas Diversas a Classificar" no balancete e não aparece na DRE. ' +
          'A confiança é MEDIDA pelo histórico real de classificações da empresa, não informada por você. ' +
          'Se a ação exigir aprovação humana, a resposta virá com situacao="aguardando_aprovacao" — informe isso ao usuário.',
        inputSchema: {
          lancamento_id: z.string().uuid().describe('ID do lançamento (financial_entry).'),
          categoria_id: z.string().uuid().describe('ID da categoria. Use listar_categorias para descobrir.'),
          justificativa: z
            .string()
            .min(10)
            .describe('Por que esta categoria, em linguagem que um contador leia. Fica gravado na trilha de auditoria.'),
          autoavaliacao: z
            .number()
            .min(0)
            .max(1)
            .optional()
            .describe('Sua própria confiança, 0 a 1. Entra como UM sinal de peso baixo entre outros — o histórico pesa mais.'),
        },
      },
      async ({ lancamento_id, categoria_id, justificativa, autoavaliacao }) => {
        const r = await classificarLancamento({
          companyId: auth.companyId,
          lancamentoId: lancamento_id,
          categoriaId: categoria_id,
          justificativa,
          opiniaoModelo:
            autoavaliacao === undefined
              ? undefined
              : { autoavaliacao, justificativa },
          trigger: 'API',
        });
        return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
      }
    );

    server.registerTool(
      'listar_categorias',
      {
        title: 'Listar o plano de categorias da empresa',
        description:
          'Lista as categorias contábeis disponíveis, com o código do plano de contas (ITG 1000, Anexo 7). ' +
          'Use antes de classificar_lancamento para escolher o id correto.',
        inputSchema: {},
      },
      async () => {
        const { getDb, eq } = await import('@hexxa/db');
        const { category } = await import('@hexxa/db/schema');
        const rows = await getDb()
          .select({
            id: category.id,
            nome: category.name,
            tipo: category.kind,
            codigo_contabil: category.accountingCode,
            grupo: category.accountingGroup,
          })
          .from(category)
          .where(eq(category.companyId, auth.companyId))
          .orderBy(category.accountingCode);
        return { content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }] };
      }
    );

    server.registerTool(
      'conciliar_transacao',
      {
        title: 'Conciliar transação bancária com lançamento',
        description:
          'Casa uma transação do extrato com um lançamento em aberto, marcando-o como pago na data do extrato. ' +
          'A confiança cai quando vários lançamentos em aberto têm o mesmo valor — nesse caso "o valor bate" não distingue nada, ' +
          'e a ação vai para revisão. Valor ou tipo divergente é recusado antes de chegar à régua.',
        inputSchema: {
          transacao_id: z.string().uuid().describe('ID da transação bancária (bank_transaction).'),
          lancamento_id: z.string().uuid().describe('ID do lançamento a baixar (financial_entry).'),
          justificativa: z.string().min(10).describe('Por que este pareamento. Fica gravado na trilha.'),
        },
      },
      async ({ transacao_id, lancamento_id, justificativa }) => {
        const r = await conciliarTransacao({
          companyId: auth.companyId,
          transacaoId: transacao_id,
          lancamentoId: lancamento_id,
          justificativa,
          trigger: 'API',
        });
        return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
      }
    );

    server.registerTool(
      'fila_de_aprovacao',
      {
        title: 'Ações da IA aguardando aprovação humana',
        description:
          'Lista o que agentes propuseram e está travado esperando alguém aprovar — emissão de nota, pagamento de guia, ' +
          'distribuição de lucro e tudo que move dinheiro para fora ou fala com terceiros. ' +
          'Cada item traz a confiança medida e a evidência que a sustenta.',
        inputSchema: {},
      },
      async () => {
        const fila = await listarFilaAprovacao(auth.companyId);
        return { content: [{ type: 'text', text: JSON.stringify(fila, null, 2) }] };
      }
    );

    server.registerTool(
      'fila_de_revisao',
      {
        title: 'Ações que a IA aplicou sozinha e ninguém conferiu ainda',
        description:
          'Lista o que foi aplicado automaticamente mas está marcado para revisão posterior. ' +
          'É o contrapeso da autonomia: a IA não trava esperando aprovação para coisa pequena, ' +
          'e mesmo assim nada que ela fez passa despercebido.',
        inputSchema: {},
      },
      async () => {
        const fila = await listarFilaRevisao(auth.companyId);
        return { content: [{ type: 'text', text: JSON.stringify(fila, null, 2) }] };
      }
    );

    server.registerTool(
      'historico_do_lancamento',
      {
        title: 'Por que este lançamento está assim',
        description:
          'Mostra tudo que um agente já propôs sobre um lançamento: o que propôs, por quê, com que confiança, ' +
          'qual evidência e quem aprovou. Responde "por que este número está aqui?".',
        inputSchema: {
          lancamento_id: z.string().uuid().describe('ID do lançamento (financial_entry).'),
        },
      },
      async ({ lancamento_id }) => {
        const h = await historicoDoLancamento(auth.companyId, lancamento_id);
        return { content: [{ type: 'text', text: JSON.stringify(h, null, 2) }] };
      }
    );

    server.registerTool(
      'decidir_acao',
      {
        title: 'Aprovar ou rejeitar uma ação pendente',
        description:
          'Registra a decisão humana sobre uma ação que ficou aguardando aprovação. ' +
          'Use APENAS quando o usuário disser explicitamente que aprova ou rejeita — você não pode aprovar as próprias propostas. ' +
          'Rejeição com motivo é o que ensina o agente a não propor de novo.',
        inputSchema: {
          acao_id: z.string().uuid().describe('ID da ação (agent_action), vindo de fila_de_aprovacao.'),
          decisao: z.enum(['aprovar', 'rejeitar']),
          nota: z.string().optional().describe('Motivo da decisão. Obrigatório na prática para rejeição.'),
          categoria_correta_id: z
            .string()
            .uuid()
            .optional()
            .describe(
              'Ao rejeitar uma classificação já aplicada: a categoria certa. Sem ela a rejeição é ' +
                'recusada, porque deixaria o lançamento na conta errada.',
            ),
        },
      },
      async ({ acao_id, decisao, nota, categoria_correta_id }) => {
        const r = await decidirAcao(
          auth.companyId,
          acao_id,
          decisao === 'aprovar' ? 'APPROVED' : 'REJECTED',
          null,
          nota,
          categoria_correta_id,
        );
        return { content: [{ type: 'text', text: JSON.stringify(r, null, 2) }] };
      }
    );
  }

  return server;
}

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, X-API-Key',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(req: Request) {
  const rawToken = extractBearerToken(req);

  if (!rawToken) {
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32001, message: 'Token de API ausente. Envie "Authorization: Bearer <token>" ou "?token=<token>".' }, id: null },
      { status: 401, headers: corsHeaders }
    );
  }

  const auth = await resolveApiToken(rawToken);
  if (!auth) {
    return Response.json(
      { jsonrpc: '2.0', error: { code: -32001, message: 'Token de API inválido ou revogado.' }, id: null },
      { status: 401, headers: corsHeaders }
    );
  }

  const server = buildServer(auth);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  const res = await transport.handleRequest(req);

  const newHeaders = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) {
    newHeaders.set(k, v);
  }
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: newHeaders,
  });
}

export async function GET() {
  return Response.json(
    {
      status: 'ok',
      name: 'hexxa-hub',
      version: '1.0.0',
      protocol: 'mcp',
      transport: 'streamable-http',
      message: 'Hexx Hub MCP Server está ativo.',
    },
    { status: 200, headers: corsHeaders }
  );
}

export async function DELETE() {
  return Response.json(
    { error: 'Este servidor MCP é stateless — não há sessão para encerrar.' },
    { status: 405, headers: corsHeaders }
  );
}

