'use server';

import { getDb, empresasDoEscritorio, cadastrarDoOneflow } from '@hexxa/db';
import type { EmpresaDisponivel, ResultadoCadastro } from '@hexxa/db';
import { requireAdmin } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Cadastro de cliente a partir do OneFlow — área do contador.
 *
 * Exige papel de administrador: criar empresa é ato do escritório, não do
 * cliente. Foi essa inversão que motivou a tela — antes o cliente precisava
 * se cadastrar sozinho para só então ser autorizado.
 */

export async function listarEmpresasAction(): Promise<{
  ok: boolean;
  empresas: EmpresaDisponivel[];
  erro?: string;
}> {
  await requireAdmin();
  try {
    return { ok: true, empresas: await empresasDoEscritorio(getDb()) };
  } catch (err) {
    return {
      ok: false,
      empresas: [],
      erro: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function cadastrarAction(
  appHash: string,
  cnpj: string,
): Promise<{ ok: boolean; resultado?: ResultadoCadastro; erro?: string }> {
  await requireAdmin();
  try {
    const r = await cadastrarDoOneflow(getDb(), appHash, cnpj);
    revalidatePath('/contador/clientes');
    revalidatePath('/contador/clientes/nova');
    return { ok: true, resultado: r };
  } catch (err) {
    return { ok: false, erro: err instanceof Error ? err.message : String(err) };
  }
}
