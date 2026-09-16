'use server';

import { getTenantContext } from '@/lib/server/tenant';
import {
  syncDistribuicaoDfe,
  getResumoMensalDfe,
  listDocsDfePorMes,
  type SyncDfeResult,
  type DistribuicaoResumoMes,
  type DistribuicaoDocRow,
} from '@/lib/server/nfse-dfe-sync';

export async function syncDfeAction(): Promise<SyncDfeResult> {
  const ctx = await getTenantContext();
  return syncDistribuicaoDfe(ctx);
}

export async function getDfeSummaryAction(): Promise<DistribuicaoResumoMes[]> {
  const ctx = await getTenantContext();
  return getResumoMensalDfe(ctx, 6);
}

export async function listDfeDocsAction(mes: string): Promise<DistribuicaoDocRow[]> {
  const ctx = await getTenantContext();
  return listDocsDfePorMes(ctx, mes);
}
