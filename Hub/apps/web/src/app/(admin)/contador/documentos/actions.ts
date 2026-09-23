'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin, adminUserId } from '@/lib/server/admin-guard';
import { enviarDocumento, historicoDaEntrega, avisarPorEmail, TIPOS_DE_DOCUMENTO, type EventoDeEntrega } from '@/lib/server/entregas';
import type { TipoDeDocumento } from '@hexxa/db';

export type EstadoDoEnvio = { ok: boolean; message: string; protocolo?: string };

export async function enviarDocumentoAction(_prev: EstadoDoEnvio, form: FormData): Promise<EstadoDoEnvio> {
  await requireAdmin();
  const companyId = String(form.get('companyId') ?? '');
  const tipo = String(form.get('tipo') ?? '') as TipoDeDocumento;
  const titulo = String(form.get('titulo') ?? '').trim();
  const valorTexto = String(form.get('valor') ?? '').replace(/\./g, '').replace(',', '.').trim();
  const valor = valorTexto ? Number(valorTexto) : null;
  const vencimento = String(form.get('vencimento') ?? '') || null;
  const arquivo = form.get('arquivo');

  if (!companyId) return { ok: false, message: 'Escolha o cliente.' };
  if (!(tipo in TIPOS_DE_DOCUMENTO)) return { ok: false, message: 'Escolha o tipo do documento.' };
  if (!titulo) return { ok: false, message: 'Dê um título ao documento.' };
  if (valor !== null && (!Number.isFinite(valor) || valor < 0)) return { ok: false, message: 'Valor inválido.' };
  if (valor && !vencimento) return { ok: false, message: 'Com valor, informe também o vencimento.' };
  const temArquivo = arquivo instanceof File && arquivo.size > 0;
  if (!temArquivo && !valor) return { ok: false, message: 'Anexe o arquivo do documento.' };

  try {
    const r = await enviarDocumento({
      companyId,
      tipo,
      titulo,
      descricao: String(form.get('descricao') ?? '').trim() || null,
      arquivo: temArquivo ? (arquivo as File) : null,
      valor,
      vencimento,
      avisarPorEmail: form.get('avisar') === 'on',
      enviadoPor: await adminUserId(),
    });
    revalidatePath('/contador/documentos');
    revalidatePath('/minha-contabilidade/guias');
    const email = r.email === 'enviado' ? ' Cliente avisado por e-mail.' : r.email === 'não solicitado' ? '' : ` E-mail ${r.email}.`;
    return { ok: true, message: `Enviado com o protocolo ${r.protocolo}.${email}`, protocolo: r.protocolo };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Não consegui enviar.' };
  }
}

export async function historicoAction(id: string): Promise<EventoDeEntrega[]> {
  await requireAdmin();
  return historicoDaEntrega(id);
}

export async function reenviarAvisoAction(id: string): Promise<string> {
  await requireAdmin();
  const r = await avisarPorEmail(id);
  revalidatePath('/contador/documentos');
  return r === 'enviado' ? 'E-mail reenviado.' : `E-mail ${r}.`;
}
