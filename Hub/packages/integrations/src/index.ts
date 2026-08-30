/**
 * @hexxa/integrations — adapters que IMPLEMENTAM as ports de @hexxa/core.
 * Uma factory por tipo, escolhendo o fornecedor por env. Assim apps/web e
 * apps/mcp só pedem "me dê um NfsePort" sem conhecer o fornecedor.
 */
import type { NfsePort, EconomicIndexPort, SignaturePort } from '@hexxa/core/ports';
import { MockNfseAdapter } from './nfse/mock-nfse.adapter';
import { GovNfseAdapter, type GovNfseConfig } from './nfse/gov-nfse.adapter';
import { BcbIndexAdapter } from './econ-index/bcb.adapter';
import { DocusealAdapter } from './signature/docuseal.adapter';

export * from './nfse/mock-nfse.adapter';
export * from './nfse/gov-nfse.adapter';
export * from './nfse/dps-builder';
export * from './nfse/evento-builder';
export * from './nfse/cert';
export * from './econ-index/bcb.adapter';
export * from './signature/docuseal.adapter';

/**
 * Mock por padrão; o gov (Emissor Nacional) é montado via makeGovNfsePort.
 * Único provedor real implementado é o Emissor Nacional (gov.br) — não há
 * integração com fornecedor terceirizado (Focus NFe/PlugNotas/eNotas): a
 * emissão direta ao padrão nacional substitui a necessidade de um.
 */
export function makeNfsePort(): NfsePort {
  return new MockNfseAdapter();
}

/** Emissor Nacional (gov.br) — requer cadastro fiscal + certificado A1. */
export function makeGovNfsePort(config: GovNfseConfig): NfsePort {
  return new GovNfseAdapter(config);
}

export function makeEconomicIndexPort(): EconomicIndexPort {
  return new BcbIndexAdapter();
}

/** Assinatura eletrônica (DocuSeal, chave única da conta). */
export function makeSignaturePort(env = process.env): SignaturePort {
  const apiKey = env.DOCUSEAL_API_KEY;
  if (!apiKey) {
    throw new Error('DOCUSEAL_API_KEY ausente. Configure a chave da API do DocuSeal (plano Pro).');
  }
  return new DocusealAdapter(apiKey);
}
