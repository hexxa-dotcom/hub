import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { RentAdjustmentService } from '@hexxa/core';
import { makeEconomicIndexPort } from '@hexxa/integrations';

/**
 * TOOLS (ações) expostas a agentes. Cada tool chama os MESMOS services do
 * domínio que a UI usa. Inputs validados com zod.
 */
export function registerFinanceTools(server: McpServer) {
  // Emitir NFSe (Meu Negócio / SERVICE).
  server.registerTool(
    'emitir_nfse',
    {
      title: 'Emitir NFSe',
      description: 'Emite uma NFSe para um cliente via a integração configurada da empresa.',
      inputSchema: {
        companyId: z.string().uuid(),
        customerName: z.string(),
        customerDocument: z.string(),
        amount: z.number().positive(),
        serviceDescription: z.string(),
        referenceMonth: z.string().regex(/^\d{4}-\d{2}$/), // o MÊS (YYYY-MM)
      },
    },
    async (input) => {
      // TODO: ServiceInvoiceService.emit(input, ctx) — usa makeNfsePort() + @hexxa/db.
      return {
        content: [
          { type: 'text', text: `NFSe enfileirada para ${input.customerName} no mês ${input.referenceMonth} (valor R$ ${input.amount}).` },
        ],
      };
    },
  );

  // Prever reajuste de aluguel (Gestão Patrimonial / HOLDING).
  server.registerTool(
    'prever_reajuste_aluguel',
    {
      title: 'Prever reajuste de aluguel',
      description: 'Calcula o reajuste IPCA/IGP-M de um aluguel quando completa 12 meses.',
      inputSchema: {
        currentRent: z.number().positive(),
        indexType: z.enum(['IPCA', 'IGPM']),
        anchorMonth: z.string().regex(/^\d{4}-\d{2}$/),
        currentMonth: z.string().regex(/^\d{4}-\d{2}$/),
      },
    },
    async (input) => {
      const svc = new RentAdjustmentService(makeEconomicIndexPort());
      const result = await svc.preview(input);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    },
  );
}
