import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceInvoiceService } from './service-invoice.service';
import type { TenantContext } from '../enums';
import type { NfsePort, NfseIssueInput, NfseIssueResult } from '../ports/nfse.port';
import type {
  CustomerRepository,
  ServiceInvoiceRepository,
  FinancialEntryRepository,
  NewServiceInvoice,
  ServiceInvoicePatch,
  ServiceInvoiceRecord,
  NewFinancialEntry,
} from '../ports/repositories';

const ctx: TenantContext = { companyId: 'company-1', companyType: 'SERVICE', userId: 'user-1' };

class FakeCustomerRepository implements CustomerRepository {
  async ensure() {
    return { id: 'customer-1' };
  }
}

class FakeServiceInvoiceRepository implements ServiceInvoiceRepository {
  invoices = new Map<string, NewServiceInvoice & { id: string } & ServiceInvoicePatch>();
  private seq = 0;

  async create(_ctx: TenantContext, data: NewServiceInvoice) {
    const id = `invoice-${++this.seq}`;
    this.invoices.set(id, { id, ...data });
    return { id };
  }
  async updateStatus(_ctx: TenantContext, id: string, patch: ServiceInvoicePatch) {
    const existing = this.invoices.get(id);
    if (existing) this.invoices.set(id, { ...existing, ...patch });
  }
  async listRecent(): Promise<ServiceInvoiceRecord[]> {
    return [];
  }
}

class FakeFinancialEntryRepository implements FinancialEntryRepository {
  entries: (NewFinancialEntry & { id: string; status: string })[] = [];
  private seq = 0;

  async create(_ctx: TenantContext, data: NewFinancialEntry) {
    const id = `entry-${++this.seq}`;
    this.entries.push({ id, ...data });
    return { id };
  }
  async cancelBySource(_ctx: TenantContext, source: string, sourceId: string) {
    for (const e of this.entries) {
      if (e.source === source && e.sourceId === sourceId) e.status = 'CANCELED';
    }
  }
}

class FakeNfsePort implements NfsePort {
  nextResult: NfseIssueResult = { providerProtocol: 'PROTO-1', status: 'ISSUED', nfseNumber: '1' };
  cancelCalls: { protocol: string; reason: string }[] = [];
  statusToReturn: NfseIssueResult | null = null;

  async issue(_input: NfseIssueInput) {
    return this.nextResult;
  }
  async cancel(providerProtocol: string, reason: string) {
    this.cancelCalls.push({ protocol: providerProtocol, reason });
  }
  async getStatus(providerProtocol: string) {
    return this.statusToReturn ?? { providerProtocol, status: 'ISSUED' as const };
  }
}

describe('ServiceInvoiceService', () => {
  let nfse: FakeNfsePort;
  let customers: FakeCustomerRepository;
  let invoices: FakeServiceInvoiceRepository;
  let entries: FakeFinancialEntryRepository;
  let service: ServiceInvoiceService;

  beforeEach(() => {
    nfse = new FakeNfsePort();
    customers = new FakeCustomerRepository();
    invoices = new FakeServiceInvoiceRepository();
    entries = new FakeFinancialEntryRepository();
    service = new ServiceInvoiceService({ nfse, customers, invoices, entries });
  });

  const baseInput = {
    customer: { name: 'Cliente Teste', document: '12345678000199' },
    amount: 1000,
    serviceDescription: 'Consultoria',
    referenceMonth: '2026-08',
  };

  it('rejeita valor zero ou negativo', async () => {
    await expect(service.emit(ctx, { ...baseInput, amount: 0 })).rejects.toThrow('valor da nota');
  });

  it('rejeita mês de referência fora do formato AAAA-MM', async () => {
    await expect(service.emit(ctx, { ...baseInput, referenceMonth: '08/2026' })).rejects.toThrow('AAAA-MM');
  });

  it('rejeita nome de cliente vazio', async () => {
    await expect(service.emit(ctx, { ...baseInput, customer: { ...baseInput.customer, name: '  ' } })).rejects.toThrow(
      'nome do cliente',
    );
  });

  it('quando ISSUED, cria o recebível (RECEIVABLE) vinculado à nota', async () => {
    const result = await service.emit(ctx, baseInput);
    expect(result.status).toBe('ISSUED');
    expect(entries.entries).toHaveLength(1);
    expect(entries.entries[0]).toMatchObject({
      type: 'RECEIVABLE',
      status: 'PENDING',
      amount: 1000,
      source: 'NFSE',
      sourceId: result.invoiceId,
    });
  });

  it('quando há imposto estimado, cria também o PAYABLE de provisão', async () => {
    const result = await service.emit(ctx, { ...baseInput, estimatedTaxAmount: 60, estimatedTaxRate: 6 });
    const payable = entries.entries.find((e) => e.type === 'PAYABLE');
    expect(payable).toBeDefined();
    expect(payable?.amount).toBe(60);
    expect(payable?.sourceId).toBe(result.invoiceId);
  });

  it('quando o provedor retorna ERROR, NÃO cria nenhum lançamento financeiro', async () => {
    nfse.nextResult = { providerProtocol: 'PROTO-1', status: 'ERROR', errorMessage: 'falhou' };
    const result = await service.emit(ctx, baseInput);
    expect(result.status).toBe('ERROR');
    expect(entries.entries).toHaveLength(0);
  });

  it('quando o provedor retorna ISSUING (assíncrono), cria o recebível mesmo assim', async () => {
    nfse.nextResult = { providerProtocol: 'PROTO-1', status: 'ISSUING' };
    const result = await service.emit(ctx, baseInput);
    expect(result.status).toBe('ISSUING');
    expect(entries.entries).toHaveLength(1);
  });

  it('propaga isMock do resultado do provedor', async () => {
    nfse.nextResult = { providerProtocol: 'mock-1', status: 'ISSUED', isMock: true };
    const result = await service.emit(ctx, baseInput);
    expect(result.isMock).toBe(true);
  });

  it('cancel(): chama o provedor, marca a nota CANCELED e cancela os lançamentos vinculados', async () => {
    const emitted = await service.emit(ctx, baseInput);
    await service.cancel(ctx, emitted.invoiceId, emitted.providerProtocol!);

    expect(nfse.cancelCalls).toHaveLength(1);
    expect(nfse.cancelCalls[0]?.protocol).toBe(emitted.providerProtocol);
    expect(invoices.invoices.get(emitted.invoiceId)?.status).toBe('CANCELED');
    expect(entries.entries.every((e) => e.status === 'CANCELED')).toBe(true);
  });

  it('cancel(): se o provedor rejeitar, propaga o erro e NÃO marca a nota como cancelada', async () => {
    const emitted = await service.emit(ctx, baseInput);
    const originalCancel = nfse.cancel.bind(nfse);
    nfse.cancel = async () => {
      throw new Error('Cancelamento rejeitado pelo Emissor Nacional');
    };

    await expect(service.cancel(ctx, emitted.invoiceId, emitted.providerProtocol!)).rejects.toThrow('rejeitado');
    expect(invoices.invoices.get(emitted.invoiceId)?.status).not.toBe('CANCELED');
    void originalCancel;
  });

  it('refreshStatus(): atualiza status/número quando o provedor sai de ISSUING', async () => {
    nfse.nextResult = { providerProtocol: 'PROTO-1', status: 'ISSUING' };
    const emitted = await service.emit(ctx, baseInput);

    nfse.statusToReturn = { providerProtocol: 'PROTO-1', status: 'ISSUED', nfseNumber: '42' };
    const newStatus = await service.refreshStatus(ctx, emitted.invoiceId, emitted.providerProtocol!);

    expect(newStatus).toBe('ISSUED');
    expect(invoices.invoices.get(emitted.invoiceId)?.status).toBe('ISSUED');
    expect(invoices.invoices.get(emitted.invoiceId)?.nfseNumber).toBe('42');
  });

  it('refreshStatus(): se o provedor retornar ERROR, cancela os lançamentos financeiros', async () => {
    nfse.nextResult = { providerProtocol: 'PROTO-1', status: 'ISSUING' };
    const emitted = await service.emit(ctx, baseInput);

    nfse.statusToReturn = { providerProtocol: 'PROTO-1', status: 'ERROR', errorMessage: 'rejeitado pelo município' };
    await service.refreshStatus(ctx, emitted.invoiceId, emitted.providerProtocol!);

    expect(entries.entries.every((e) => e.status === 'CANCELED')).toBe(true);
  });

  it('refreshStatus(): enquanto ainda ISSUING, não mexe no status nem nos lançamentos', async () => {
    nfse.nextResult = { providerProtocol: 'PROTO-1', status: 'ISSUING' };
    const emitted = await service.emit(ctx, baseInput);

    nfse.statusToReturn = { providerProtocol: 'PROTO-1', status: 'ISSUING' };
    await service.refreshStatus(ctx, emitted.invoiceId, emitted.providerProtocol!);

    expect(invoices.invoices.get(emitted.invoiceId)?.status).toBe('ISSUING');
    expect(entries.entries.every((e) => e.status === 'PENDING')).toBe(true);
  });
});
