import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

/**
 * PROMPTS padronizados. Carregam as regras de linguagem do produto para que
 * o agente responda no tom comercial correto (valor / mês).
 */
export function registerAccountingPrompts(server: McpServer) {
  server.registerPrompt(
    'explicar_situacao_fiscal',
    {
      title: 'Explicar situação fiscal do mês',
      description: 'Gera uma explicação simples e comercial da situação fiscal da empresa no mês.',
      argsSchema: {
        companyId: z.string().uuid(),
        referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
      },
    },
    ({ companyId, referenceMonth }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text:
              `Explique de forma simples e comercial a situação fiscal da empresa ${companyId} ` +
              `no mês ${referenceMonth}. Use o recurso hexxa://company/${companyId}/dashboard. ` +
              `REGRAS DE LINGUAGEM: nunca diga "investimento" (use "valor"); ` +
              `nunca diga "competência" (use "mês"). Sem jargão contábil.`,
          },
        },
      ],
    }),
  );
}
