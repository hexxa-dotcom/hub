/**
 * Cliente HTTP da API do Nibo (Empresas) — usado apenas para IMPORTAR dados
 * (contas a pagar/receber, clientes) de empresas que ainda usam o Nibo como
 * gerenciador financeiro, enquanto migram pro Hub. Não emite nada no Nibo.
 * Doc: https://nibo.readme.io/reference/como-utilizar-a-api
 */

const DEFAULT_BASE_URL = 'https://api.nibo.com.br/empresas/v1';
const PAGE_SIZE = 500; // limite máximo por request da API do Nibo

export interface NiboStakeholder {
  id: string;
  name: string;
  cpfCnpj?: string;
}

export interface NiboSchedule {
  scheduleId: string;
  type: 'Credit' | 'Debit';
  value: number;
  openValue: number;
  dueDate: string; // ISO
  isPaid: boolean;
  description: string;
  stakeholder: NiboStakeholder | null;
}

interface NiboScheduleRaw {
  scheduleId: string;
  type: 'Credit' | 'Debit';
  value: number;
  openValue: number;
  dueDate: string;
  isPaid: boolean;
  description: string;
  stakeholder?: { id: string; name: string; cpfCnpj?: string };
}

export interface NiboCustomer {
  id: string;
  name: string;
  document: string | null;
  documentType: 'Cpf' | 'Cnpj' | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  isCompany: boolean;
}

interface NiboCustomerRaw {
  id: string;
  name: string;
  isCompany?: boolean;
  email?: string;
  phone?: string;
  document?: { number?: string; type?: 'Cpf' | 'Cnpj' };
  address?: {
    line1?: string;
    number?: number | string;
    district?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
}

export class NiboAdapter {
  constructor(
    private readonly apiToken: string,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  private async fetchAllPages<T>(path: string, orderBy: string): Promise<T[]> {
    const items: T[] = [];
    let skip = 0;
    for (;;) {
      const url = `${this.baseUrl}${path}?$top=${PAGE_SIZE}&$skip=${skip}&$orderby=${encodeURIComponent(orderBy)}`;
      const res = await fetch(url, {
        headers: { apitoken: this.apiToken, Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Nibo API ${path}: HTTP ${res.status} — ${await res.text()}`);
      }
      const json = (await res.json()) as { items: T[]; count: number };
      items.push(...json.items);
      skip += PAGE_SIZE;
      if (json.items.length < PAGE_SIZE || skip >= json.count) break;
    }
    return items;
  }

  private mapSchedule(raw: NiboScheduleRaw): NiboSchedule {
    return {
      scheduleId: raw.scheduleId,
      type: raw.type,
      value: raw.value,
      openValue: raw.openValue,
      dueDate: raw.dueDate,
      isPaid: raw.isPaid,
      description: raw.description,
      stakeholder: raw.stakeholder
        ? { id: raw.stakeholder.id, name: raw.stakeholder.name, cpfCnpj: raw.stakeholder.cpfCnpj }
        : null,
    };
  }

  async listCreditSchedules(): Promise<NiboSchedule[]> {
    const raw = await this.fetchAllPages<NiboScheduleRaw>('/schedules/credit', 'dueDate');
    return raw.map((r) => this.mapSchedule(r));
  }

  async listDebitSchedules(): Promise<NiboSchedule[]> {
    const raw = await this.fetchAllPages<NiboScheduleRaw>('/schedules/debit', 'dueDate');
    return raw.map((r) => this.mapSchedule(r));
  }

  private mapCustomer(raw: NiboCustomerRaw): NiboCustomer {
    const addr = raw.address;
    const addressParts = addr
      ? [
          addr.line1,
          addr.number != null ? String(addr.number) : undefined,
          addr.district,
          addr.city,
          addr.state,
          addr.zipCode?.trim(),
        ].filter(Boolean)
      : [];
    return {
      id: raw.id,
      name: raw.name,
      document: raw.document?.number ?? null,
      documentType: raw.document?.type ?? null,
      email: raw.email ?? null,
      phone: raw.phone ?? null,
      address: addressParts.length ? addressParts.join(', ') : null,
      isCompany: raw.isCompany ?? false,
    };
  }

  async listCustomers(): Promise<NiboCustomer[]> {
    const raw = await this.fetchAllPages<NiboCustomerRaw>('/customers', 'name');
    return raw.map((r) => this.mapCustomer(r));
  }
}
