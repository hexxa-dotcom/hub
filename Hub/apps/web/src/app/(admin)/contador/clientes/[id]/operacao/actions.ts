'use server';

import { getDb } from '@hexxa/db';
import {
  configuracaoDaEmpresa,
  salvarExcecoesDaEmpresa,
  voltarAoPadrao,
  type ConfiguracaoDaEmpresa,
} from '@hexxa/db';
import type { SettingsParcial } from '@hexxa/core';
import { requireAdmin, adminUserId } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Configuração de operação de UMA empresa — área do contador.
 *
 * Toda ação exige papel de administrador: estas chaves decidem o que a IA pode
 * fazer com a contabilidade de um cliente, e não são do cliente para mexer.
 */

export async function carregarConfiguracao(companyId: string): Promise<ConfiguracaoDaEmpresa> {
  await requireAdmin();
  return configuracaoDaEmpresa(getDb(), companyId);
}

/**
 * Grava as exceções da empresa.
 *
 * Recebe o conjunto COMPLETO de exceções, não um incremento. É o que permite
 * remover uma exceção: mandar o conjunto sem ela. Mesclar tornaria "voltar ao
 * padrão" uma operação impossível de expressar.
 */
export async function salvarConfiguracao(
  companyId: string,
  parcial: SettingsParcial,
): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();
  const userId = await adminUserId();

  await salvarExcecoesDaEmpresa(getDb(), companyId, parcial, userId);
  revalidatePath(`/contador/clientes/${companyId}/operacao`);
  return { ok: true, message: 'Configuração salva.' };
}

/** Apaga as exceções: a empresa volta a herdar tudo do padrão. */
export async function restaurarPadrao(companyId: string): Promise<{ ok: boolean; message: string }> {
  await requireAdmin();

  await voltarAoPadrao(getDb(), companyId);
  revalidatePath(`/contador/clientes/${companyId}/operacao`);
  return { ok: true, message: 'Empresa voltou ao padrão do sistema.' };
}
