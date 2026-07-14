import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TaxThermometerService } from '@hexxa/core';

/**
 * RESOURCES (dados read-only) expostos a agentes.
 * URIs padronizadas: hexxa://company/{companyId}/<recurso>
 */
export function registerCompanyResources(server: McpServer) {
  // Dashboard consolidado do mês (Faturamento, Despesas, Termômetro).
  server.registerResource(
    'company-dashboard',
    new ResourceTemplate('hexxa://company/{companyId}/dashboard', { list: undefined }),
    {
      title: 'Dashboard da empresa',
      description: 'Resumo do mês: Faturamento do Mês, Despesas do Mês e Termômetro Tributário.',
      mimeType: 'application/json',
    },
    async (uri, { companyId }) => {
      // TODO: ler de @hexxa/db via withTenant(companyId, ...). Stub ilustrativo:
      const thermo = new TaxThermometerService().evaluate({
        revenueCeiling: 4_800_000,
        revenueLast12Months: 3_900_000,
        payrollLast12Months: 1_200_000,
      });
      const payload = {
        companyId,
        // labels respeitam a regra de linguagem (valor / mês)
        faturamentoDoMes: 0,
        despesasDoMes: 0,
        provisaoImpostoEstimado: 0,
        termometroTributario: thermo,
      };
      return { contents: [{ uri: uri.href, text: JSON.stringify(payload, null, 2) }] };
    },
  );

  // Guias de imposto do mês (com Pix copia-e-cola).
  server.registerResource(
    'company-tax-guides',
    new ResourceTemplate('hexxa://company/{companyId}/guias/{referenceMonth}', { list: undefined }),
    {
      title: 'Guias de imposto do mês',
      description: 'Guias do mês informado (YYYY-MM), incluindo valor, vencimento e código Pix.',
      mimeType: 'application/json',
    },
    async (uri, { companyId, referenceMonth }) => {
      const payload = { companyId, mes: referenceMonth, guias: [] };
      return { contents: [{ uri: uri.href, text: JSON.stringify(payload, null, 2) }] };
    },
  );
}
