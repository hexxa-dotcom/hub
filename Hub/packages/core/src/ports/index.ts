/**
 * Barril de ports. O domínio importa daqui; quem injeta implementações
 * (apps/web, apps/mcp) liga estas interfaces aos adapters de packages/integrations
 * e aos repositórios de packages/db.
 */
export * from './nfse.port';
export * from './signature.port';
export * from './open-finance.port';
export * from './repositories';

/** Provedor de séries de índices econômicos (IPCA/IGP-M) para reajuste. */
export interface EconomicIndexPort {
  /** Variação acumulada (fração, ex.: 0.0452 = 4,52%) do índice no intervalo. */
  accumulatedChange(index: 'IPCA' | 'IGPM', fromMonth: string, toMonth: string): Promise<number>;
}
