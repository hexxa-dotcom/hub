import type {
  NfsePort,
  NfseIssueInput,
  NfseIssueResult,
} from '@hexxa/core/ports';

/**
 * Adapter de NFSe usando a API Focus NFe. IMPLEMENTA a port NfsePort.
 * Trocar de fornecedor (PlugNotas, eNotas) = criar outro adapter; o domínio
 * não muda. Substitua o corpo das chamadas pelos endpoints reais.
 */
export class FocusNfseAdapter implements NfsePort {
  constructor(
    private readonly config: { baseUrl: string; token: string },
  ) {}

  private headers() {
    // Focus usa basic auth com o token como usuário.
    const basic = Buffer.from(`${this.config.token}:`).toString('base64');
    return { Authorization: `Basic ${basic}`, 'Content-Type': 'application/json' };
  }

  async issue(input: NfseIssueInput): Promise<NfseIssueResult> {
    const ref = `hexxa-${input.referenceMonth}-${crypto.randomUUID()}`;
    const res = await fetch(`${this.config.baseUrl}/v2/nfse?ref=${ref}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        // mapeamento domínio -> payload do fornecedor
        prestador: { /* dados da empresa */ },
        tomador: {
          razao_social: input.customer.name,
          cnpj: input.customer.document,
          email: input.customer.email,
        },
        servico: {
          discriminacao: input.serviceDescription,
          valor_servicos: input.amount,
        },
      }),
    });

    if (!res.ok) {
      return { providerProtocol: ref, status: 'ERROR', errorMessage: await res.text() };
    }
    return { providerProtocol: ref, status: 'ISSUING' };
  }

  async getStatus(providerProtocol: string): Promise<NfseIssueResult> {
    const res = await fetch(`${this.config.baseUrl}/v2/nfse/${providerProtocol}`, {
      headers: this.headers(),
    });
    const data = (await res.json()) as Record<string, unknown>;
    const status = data.status === 'autorizado' ? 'ISSUED' : data.status === 'erro' ? 'ERROR' : 'ISSUING';
    return {
      providerProtocol,
      status,
      nfseNumber: data.numero as string | undefined,
      pdfUrl: data.url_danfse as string | undefined,
      xmlUrl: data.caminho_xml_nota_fiscal as string | undefined,
    };
  }

  async cancel(providerProtocol: string, reason: string): Promise<void> {
    await fetch(`${this.config.baseUrl}/v2/nfse/${providerProtocol}`, {
      method: 'DELETE',
      headers: this.headers(),
      body: JSON.stringify({ justificativa: reason }),
    });
  }
}

/** Implementação fake para dev/testes sem chamar a API real. */
export class MockNfseAdapter implements NfsePort {
  async issue(input: NfseIssueInput): Promise<NfseIssueResult> {
    return { providerProtocol: `mock-${Date.now()}`, status: 'ISSUED', nfseNumber: '000123' };
  }
  async getStatus(p: string): Promise<NfseIssueResult> {
    return { providerProtocol: p, status: 'ISSUED', nfseNumber: '000123' };
  }
  async cancel(): Promise<void> {}
}
