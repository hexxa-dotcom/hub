/** Enums do domínio — espelham os enums do Postgres (packages/db). */

export const CompanyType = {
  SERVICE: 'SERVICE',
  HOLDING: 'HOLDING',
} as const;
export type CompanyType = (typeof CompanyType)[keyof typeof CompanyType];

export const TaxRegime = {
  SIMPLES_NACIONAL: 'SIMPLES_NACIONAL',
  LUCRO_PRESUMIDO: 'LUCRO_PRESUMIDO',
  LUCRO_REAL: 'LUCRO_REAL',
} as const;
export type TaxRegime = (typeof TaxRegime)[keyof typeof TaxRegime];

export const EntryType = {
  PAYABLE: 'PAYABLE',
  RECEIVABLE: 'RECEIVABLE',
} as const;
export type EntryType = (typeof EntryType)[keyof typeof EntryType];

export const IndexType = {
  IPCA: 'IPCA',
  IGPM: 'IGPM',
} as const;
export type IndexType = (typeof IndexType)[keyof typeof IndexType];

export const IntegrationKind = {
  NFSE: 'NFSE',
  ELECTRONIC_SIGNATURE: 'ELECTRONIC_SIGNATURE',
  OPEN_FINANCE: 'OPEN_FINANCE',
} as const;
export type IntegrationKind = (typeof IntegrationKind)[keyof typeof IntegrationKind];

/** Contexto multi-tenant injetado em todo service. */
export interface TenantContext {
  companyId: string;
  companyType: CompanyType;
  userId: string;
}
