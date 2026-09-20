'use server';

import {
  getDb,
  montarCadastroOneflow,
  aprovarCadastro,
  trazerDoOneflow,
  type EscolhasDaAprovacao,
  type CadastroMontado,
} from '@hexxa/db';
import { requireAdmin } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Aprovação do cadastro na ficha do cliente — ver `aprovacao-cadastro.ts`.
 *
 * A prévia não fala com o OneFlow: monta o que seria enviado e diz o que
 * falta. Só `aprovarCadastroAction` cria alguma coisa lá.
 */

export async function previaAprovacaoAction(
  companyId: string,
  escolhas: EscolhasDaAprovacao,
): Promise<CadastroMontado> {
  await requireAdmin();
  return montarCadastroOneflow(getDb(), companyId, escolhas);
}

export async function aprovarCadastroAction(
  companyId: string,
  escolhas: EscolhasDaAprovacao,
): Promise<{ ok: boolean; mensagem: string; avisos?: string[] }> {
  await requireAdmin();
  try {
    const r = await aprovarCadastro(getDb(), companyId, escolhas);
    revalidatePath(`/contador/clientes/${companyId}`);
    revalidatePath('/contador/clientes');
    return {
      ok: true,
      mensagem:
        (r.noOneflow === 'CRIADA'
          ? 'Empresa criada no OneFlow e acesso do cliente liberado.'
          : 'A empresa já estava no OneFlow; acesso do cliente liberado.') +
        ' Agora defina as regras tributárias lá e use "Trazer do OneFlow".',
      avisos: [...r.avisos, ...(r.sincronizacao?.avisos ?? [])],
    };
  } catch (err) {
    return { ok: false, mensagem: err instanceof Error ? err.message : String(err) };
  }
}

export async function trazerDoOneflowAction(
  companyId: string,
): Promise<{ ok: boolean; mensagem: string; avisos?: string[] }> {
  await requireAdmin();
  try {
    const r = await trazerDoOneflow(getDb(), companyId);
    revalidatePath(`/contador/clientes/${companyId}`);
    return {
      ok: true,
      mensagem: `Cadastro atualizado com o OneFlow: ${r.socios} sócio(s), módulos ${r.modulos.join(', ') || 'nenhum'}.`,
      avisos: r.avisos,
    };
  } catch (err) {
    return { ok: false, mensagem: err instanceof Error ? err.message : String(err) };
  }
}
