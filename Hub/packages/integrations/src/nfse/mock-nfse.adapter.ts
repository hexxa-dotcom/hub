import type { NfseIssueInput, NfseIssueResult, NfsePort } from '@hexxa/core/ports';

/** Implementação fake para dev/testes sem chamar a API real. */
export class MockNfseAdapter implements NfsePort {
  async issue(input: NfseIssueInput): Promise<NfseIssueResult> {
    // Número óbvio de teste (nunca um "000123" fixo, que passa por número real
    // de protocolo) — junto com isMock:true, é o que impede a UI de mostrar
    // uma nota fake como se fosse uma emissão de verdade.
    const fake = `TESTE-${Date.now().toString().slice(-6)}`;
    return { providerProtocol: `mock-${Date.now()}`, status: 'ISSUED', nfseNumber: fake, isMock: true };
  }
  async getStatus(p: string): Promise<NfseIssueResult> {
    return { providerProtocol: p, status: 'ISSUED', nfseNumber: `TESTE-${p.slice(-6)}`, isMock: true };
  }
  async cancel(): Promise<void> {}
}
