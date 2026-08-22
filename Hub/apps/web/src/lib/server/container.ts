import 'server-only';
import { ServiceInvoiceService, ContractSignatureService } from '@hexxa/core';
import type { TenantContext } from '@hexxa/core';
import { makeNfsePort, makeGovNfsePort, makeSignaturePort } from '@hexxa/integrations';
import type { CertMaterial } from '@hexxa/integrations';
import type { NfsePort } from '@hexxa/core/ports';
import {
  DrizzleCustomerRepository,
  DrizzleServiceInvoiceRepository,
  DrizzleFinancialEntryRepository,
  DrizzleSignatureRequestRepository,
} from '@hexxa/db';
import { getNfseConfig, getCertForTenant, isFiscalComplete, reserveNextDpsNumber, type NfseConfig } from './fiscal';

/**
 * Composition root: injeta adapters (integrations) + repositórios (Supabase)
 * nas ports do core. Decide o provedor de NFSe:
 *  - cadastro fiscal completo + certificado A1 presente → Emissor Nacional (gov)
 *  - caso contrário                                      → mock (modo teste)
 */
function buildNfsePort(cfg: NfseConfig | null, cert: CertMaterial | null, dpsNumber?: number): NfsePort {
  if (cfg && isFiscalComplete(cfg) && cert) {
    return makeGovNfsePort({
      emitente: {
        ambiente: cfg.ambiente,
        cnpj: cfg.cnpj!,
        inscricaoMunicipal: cfg.inscricaoMunicipal ?? undefined,
        codigoMunicipio: cfg.codigoMunicipio!,
        optanteSimples: cfg.optanteSimples,
        regimeEspecial: cfg.regimeEspecial,
        regimeApuracao: cfg.regimeApuracao,
        fone: cfg.telefone ?? undefined,
        email: cfg.emailContato ?? undefined,
      },
      servico: {
        itemListaServico: cfg.itemListaServico || '00.00',
        aliquotaIss: cfg.aliquotaIss ?? undefined,
        codigoTributacaoMunicipio: cfg.codigoTributacaoMunicipio ?? undefined,
      },
      cert,
      serie: cfg.serieDps,
      nextNumber: dpsNumber ?? cfg.proxNumeroDps,
    });
  }
  return makeNfsePort(); // mock enquanto não há certificado/cadastro completo
}

export async function makeServiceInvoiceService(ctx: TenantContext) {
  const cfg = await getNfseConfig(ctx);
  const cert = await getCertForTenant(ctx);
  // Emissão real (gov): reserva o número da DPS de forma atômica para não
  // repetir numeração entre emissões (gaps são permitidos pelo padrão nacional).
  const isGov = Boolean(cfg && isFiscalComplete(cfg) && cert);
  const dpsNumber = isGov ? await reserveNextDpsNumber(ctx) : undefined;
  return new ServiceInvoiceService({
    nfse: buildNfsePort(cfg, cert, dpsNumber),
    customers: new DrizzleCustomerRepository(),
    invoices: new DrizzleServiceInvoiceRepository(),
    entries: new DrizzleFinancialEntryRepository(),
  });
}

/** Provedor ativo agora — para a UI mostrar "mock" vs "Emissor Nacional". */
export async function nfseMode(ctx: TenantContext): Promise<'gov' | 'mock'> {
  const cfg = await getNfseConfig(ctx);
  const cert = await getCertForTenant(ctx);
  return isFiscalComplete(cfg) && cert ? 'gov' : 'mock';
}

export const serviceInvoiceRepository = new DrizzleServiceInvoiceRepository();

export async function resolveNfsePort(ctx: TenantContext): Promise<NfsePort> {
  const cfg = await getNfseConfig(ctx);
  const cert = await getCertForTenant(ctx);
  return buildNfsePort(cfg, cert);
}

export const signatureRequestRepository = new DrizzleSignatureRequestRepository();

export function makeContractSignatureService(): ContractSignatureService {
  return new ContractSignatureService({
    signature: makeSignaturePort(),
    requests: signatureRequestRepository,
  });
}
