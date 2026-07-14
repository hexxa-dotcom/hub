/**
 * @hexxa/integrations — adapters que IMPLEMENTAM as ports de @hexxa/core.
 * Uma factory por tipo, escolhendo o fornecedor por env. Assim apps/web e
 * apps/mcp só pedem "me dê um NfsePort" sem conhecer o fornecedor.
 */
import type { NfsePort, EconomicIndexPort } from '@hexxa/core/ports';
import { FocusNfseAdapter, MockNfseAdapter } from './nfse/focus-nfse.adapter';
import { GovNfseAdapter, type GovNfseConfig } from './nfse/gov-nfse.adapter';
import { BcbIndexAdapter } from './econ-index/bcb.adapter';

export * from './nfse/focus-nfse.adapter';
export * from './nfse/gov-nfse.adapter';
export * from './nfse/dps-builder';
export * from './nfse/cert';
export * from './econ-index/bcb.adapter';

/** Mock por padrão; o gov (Emissor Nacional) é montado via makeGovNfsePort. */
export function makeNfsePort(env = process.env): NfsePort {
  if (env.NFSE_PROVIDER === 'focus') {
    return new FocusNfseAdapter({ baseUrl: env.NFSE_API_BASE_URL!, token: env.NFSE_API_TOKEN! });
  }
  return new MockNfseAdapter();
}

/** Emissor Nacional (gov.br) — requer cadastro fiscal + certificado A1. */
export function makeGovNfsePort(config: GovNfseConfig): NfsePort {
  return new GovNfseAdapter(config);
}

export function makeEconomicIndexPort(): EconomicIndexPort {
  return new BcbIndexAdapter();
}
