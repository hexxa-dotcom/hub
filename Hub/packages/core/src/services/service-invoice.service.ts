/**
 * Emissão de NFSe — regra de negócio (orquestração) do módulo "Meu Negócio".
 * Liga: provedor de NFSe (port) + repositórios (ports). NÃO conhece HTTP nem SQL.
 *
 * Fluxo: garante cliente → cria nota (ISSUING) → emite no provedor → atualiza
 * status/protocolo → se ok, cria o RECEIVABLE na camada financeira unificada.
 */
import type { TenantContext } from '../enums';
import type { NfsePort } from '../ports/nfse.port';
import type {
  CustomerRepository,
  ServiceInvoiceRepository,
  FinancialEntryRepository,
} from '../ports/repositories';

export interface EmitNfseInput {
  customer: { name: string; document: string; email?: string };
  amount: number;
  serviceDescription: string;
  referenceMonth: string;
  /** data de competência completa YYYY-MM-DD. */
  competenciaDate?: string;
  /** vencimento do recebível YYYY-MM-DD (default: dia 10 do mês). */
  dueDate?: string;
  retainIss?: boolean;
  /** Imposto estimado a pagar por esta nota. Se informado, gera um PAYABLE automático. */
  estimatedTaxAmount?: number;
  /** Alíquota efetiva usada no cálculo acima (%), só pra exibição. */
  estimatedTaxRate?: number;
  serviceOverride?: {
    itemListaServico: string;
    codigoTributacaoMunicipio?: string;
    aliquotaIss?: number;
    cnae?: string;
  };
}

export interface EmitNfseResult {
  invoiceId: string;
  status: 'ISSUING' | 'ISSUED' | 'ERROR' | 'CANCELED';
  nfseNumber?: string;
  providerProtocol?: string;
  financialEntryId?: string;
  isMock?: boolean;
}

export interface ServiceInvoiceDeps {
  nfse: NfsePort;
  customers: CustomerRepository;
  invoices: ServiceInvoiceRepository;
  entries: FinancialEntryRepository;
}

const MONTH_RE = /^\d{4}-\d{2}$/;

export class ServiceInvoiceService {
  constructor(private readonly deps: ServiceInvoiceDeps) {}

  async emit(ctx: TenantContext, input: EmitNfseInput): Promise<EmitNfseResult> {
    // 1. Validação de domínio (linguagem comercial nas mensagens).
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new Error('O valor da nota deve ser maior que zero.');
    }
    if (!MONTH_RE.test(input.referenceMonth)) {
      throw new Error('Informe o mês no formato AAAA-MM.');
    }
    if (!input.customer.name.trim()) {
      throw new Error('Informe o nome do cliente.');
    }

    // 2. Garante o cliente no tenant.
    const customer = await this.deps.customers.ensure(ctx, input.customer);

    // 3. Cria a nota como ISSUING (em emissão).
    const invoice = await this.deps.invoices.create(ctx, {
      customerId: customer.id,
      amount: input.amount,
      serviceDescription: input.serviceDescription,
      referenceMonth: input.referenceMonth,
      status: 'ISSUING',
      taxAmount: input.estimatedTaxAmount,
      taxRate: input.estimatedTaxRate,
    });

    // 4. Emite no provedor (port -> adapter de packages/integrations).
    const issued = await this.deps.nfse.issue({
      customer: input.customer,
      amount: input.amount,
      serviceDescription: input.serviceDescription,
      referenceMonth: input.referenceMonth,
      competenciaDate: input.competenciaDate,
      retainIss: input.retainIss,
      serviceOverride: input.serviceOverride,
    });

    // 5. Atualiza status/protocolo da nota.
    await this.deps.invoices.updateStatus(ctx, invoice.id, {
      status: issued.status,
      providerProtocol: issued.providerProtocol,
      nfseNumber: issued.nfseNumber,
      providerMode: issued.isMock ? 'mock' : 'gov',
    });

    // 6. Se não falhou, gera o recebível na camada financeira unificada.
    let financialEntryId: string | undefined;
    if (issued.status !== 'ERROR') {
      const entry = await this.deps.entries.create(ctx, {
        type: 'RECEIVABLE',
        status: 'PENDING',
        description: `NFSe — ${input.serviceDescription}`,
        amount: input.amount,
        dueDate: input.dueDate ?? `${input.referenceMonth}-10`,
        referenceMonth: input.referenceMonth,
        source: 'NFSE',
        sourceId: invoice.id,
      });
      financialEntryId = entry.id;

      // 7. Se houver imposto estimado, gera a despesa (PAYABLE) do imposto.
      if (input.estimatedTaxAmount && input.estimatedTaxAmount > 0) {
        await this.deps.entries.create(ctx, {
          type: 'PAYABLE',
          status: 'PENDING',
          description: `Provisão de Imposto - NFSe`,
          amount: input.estimatedTaxAmount,
          dueDate: input.dueDate ?? `${input.referenceMonth}-20`, // DAS geralmente vence dia 20
          referenceMonth: input.referenceMonth,
          source: 'NFSE',
          sourceId: invoice.id,
        });
      }
    }

    return {
      invoiceId: invoice.id,
      status: issued.status,
      nfseNumber: issued.nfseNumber,
      providerProtocol: issued.providerProtocol,
      financialEntryId,
      isMock: issued.isMock,
    };
  }

  async cancel(ctx: TenantContext, id: string, protocol: string): Promise<void> {
    await this.deps.nfse.cancel(protocol, 'Cancelamento solicitado pelo emitente');
    await this.deps.invoices.updateStatus(ctx, id, { status: 'CANCELED' });
    await this.deps.entries.cancelBySource(ctx, 'NFSE', id);
  }

  async refreshStatus(ctx: TenantContext, id: string, protocol: string): Promise<string> {
    const result = await this.deps.nfse.getStatus(protocol);
    if (result.status !== 'ISSUING') {
      await this.deps.invoices.updateStatus(ctx, id, {
        status: result.status,
        nfseNumber: result.nfseNumber,
      });
      if (result.status === 'ERROR' || result.status === 'CANCELED') {
        await this.deps.entries.cancelBySource(ctx, 'NFSE', id);
      }
    }
    return result.status;
  }
}
