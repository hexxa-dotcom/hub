'use server';

import {
  getDb,
  convidarParaEmpresa,
  acessosDaEmpresa,
  removerAcesso,
  EmailInvalidoError,
} from '@hexxa/db';
import type { Convidado, PapelDeConvite, ResultadoConvite } from '@hexxa/db';
import { requireAdmin } from '@/lib/server/admin-guard';
import { revalidatePath } from 'next/cache';

/**
 * Acesso do cliente à própria empresa — área do contador.
 *
 * Convidar é ato do escritório: a empresa foi criada aqui, a partir do
 * OneFlow, e quem sabe qual e-mail é o do dono é quem tem o contrato. Era o
 * fluxo invertido que travava — o cliente se cadastrava sozinho e esperava
 * autorização.
 */

export interface EstadoConvite {
  ok: boolean;
  mensagem: string;
  resultado?: ResultadoConvite;
}

const PAPEIS: PapelDeConvite[] = ['OWNER', 'ADMIN', 'FINANCE', 'STAFF', 'VIEWER'];

export async function convidarAction(
  _prev: EstadoConvite,
  formData: FormData,
): Promise<EstadoConvite> {
  await requireAdmin();

  const companyId = String(formData.get('companyId') ?? '');
  const email = String(formData.get('email') ?? '');
  const nome = String(formData.get('nome') ?? '');
  const papelBruto = String(formData.get('papel') ?? 'OWNER');

  if (!companyId) return { ok: false, mensagem: 'Empresa não identificada.' };

  // O papel vem de um <select>, mas chega como texto: validar aqui evita que
  // um valor forjado entre no enum do banco e derrube a inserção com um erro
  // que não explica nada.
  const papel = (PAPEIS as string[]).includes(papelBruto)
    ? (papelBruto as PapelDeConvite)
    : 'VIEWER';

  try {
    const r = await convidarParaEmpresa(getDb(), companyId, email, papel, nome);
    revalidatePath(`/contador/clientes/${companyId}/acessos`);
    revalidatePath(`/contador/clientes/${companyId}`);

    const mensagem = r.jaEraMembro
      ? `${r.email} já tinha acesso — o papel foi atualizado para ${papel}.`
      : r.jaTinhaConta
        ? `${r.email} já tem conta no Hub e agora acessa esta empresa.`
        : `Convite criado para ${r.email}. O acesso vale assim que ela se cadastrar com esse e-mail.`;

    return { ok: true, mensagem, resultado: r };
  } catch (err) {
    if (err instanceof EmailInvalidoError) return { ok: false, mensagem: err.message };
    return { ok: false, mensagem: err instanceof Error ? err.message : String(err) };
  }
}

export async function listarAcessosAction(companyId: string): Promise<Convidado[]> {
  await requireAdmin();
  return acessosDaEmpresa(getDb(), companyId);
}

export async function removerAcessoAction(
  companyId: string,
  userId: string,
): Promise<{ ok: boolean; erro?: string }> {
  await requireAdmin();
  const r = await removerAcesso(getDb(), companyId, userId);
  if (!r.removido) return { ok: false, erro: r.motivo ?? 'Não consegui remover este acesso.' };
  revalidatePath(`/contador/clientes/${companyId}/acessos`);
  return { ok: true };
}
