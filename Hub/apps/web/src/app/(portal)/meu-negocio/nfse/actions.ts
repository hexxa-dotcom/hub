'use server';

import { revalidatePath } from 'next/cache';
import { makeServiceInvoiceService, makeServiceInvoiceServiceReadOnly, serviceInvoiceRepository, resolveNfsePort } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';
import { emitirNota } from '@/lib/server/emissao';
import { agendar } from '@/lib/server/emissao-agendada';
import { getDb, sql } from '@hexxa/db';
import { consultarCnpj } from '@/lib/server/cnpj';

export type EmitState = {
  ok: boolean;
  message: string;
  status?: 'ISSUED' | 'ISSUING' | 'ERROR';
  nfseNumber?: string;
  taxAmount?: number;
  taxRate?: number;
  netAmount?: number;
  invoiceId?: string;
  providerProtocol?: string;
  /** Precisa de um "sim" antes de emitir (nota igual no mesmo mês). */
  precisaConfirmar?: 'DUPLICADA';
  /** Link do WhatsApp com a mensagem da nota, pronto para enviar. */
  whatsappLink?: string;
};

export async function emitNfseAction(_prev: EmitState, formData: FormData): Promise<EmitState> {
  try {
    const ctx = await getTenantContext();
    const txt = (k: string) => String(formData.get(k) ?? '').trim();
    const desc = txt('serviceDescription');
    const info = txt('additionalInfo');
    const cMun = txt('cMun').replace(/\D/g, '');
    // Um caminho só para toda emissão — ver `emitirNota` (travas, CNPJ, e-mail).
    const valor = parseFloat(txt('amount').replace(',', '.')) || 0;
    const descricao = info ? `${desc}\n\nInformações Adicionais:\n${info}` : desc;
    const r = await emitirNota(ctx, {
      customerId: txt('customerId') || undefined,
      cliente: {
        nome: txt('customerName'),
        documento: txt('customerDocument'),
        email: txt('customerEmail') || undefined,
        endereco: cMun
          ? {
              cep: txt('cep').replace(/\D/g, ''),
              cMun,
              logradouro: txt('logradouro'),
              numero: txt('numero'),
              complemento: txt('complemento') || undefined,
              bairro: txt('bairro'),
              municipio: txt('municipio'),
              uf: txt('uf'),
            }
          : undefined,
      },
      valor,
      descricao,
      perfilId: txt('profileId') || undefined,
      competencia: txt('competenciaDate') || undefined,
      reterIss: formData.get('retainIss') === 'on',
      confirmarDuplicada: formData.get('confirmarDuplicada') === '1',
      parcelaId: txt('parcelaId') || undefined,
      emails: txt('emails').split(/[,;\s]+/).filter((e) => e.includes('@')),
      whatsapp: txt('whatsapp') || undefined,
    });

    // "Depois desta": deixar a próxima já agendada, para o mesmo cliente.
    const depois = txt('depois');
    if (r.ok && r.invoiceId && (depois === 'mensal' || depois === 'data')) {
      const [nota] = (await getDb().execute(sql`
        SELECT customer_id::text AS id FROM service_invoice WHERE id = ${r.invoiceId} AND company_id = ${ctx.companyId}
      `)) as unknown as { id: string | null }[];
      const data = txt('depoisData');
      if (nota?.id && data) {
        const a = await agendar(ctx.companyId, {
          customerId: nota.id,
          perfilId: txt('profileId') || undefined,
          descricao,
          valor,
          data,
          repetir: depois === 'mensal',
        });
        return { ...r, message: `${r.message} ${a.ok ? a.mensagem : `Não agendei a próxima: ${a.mensagem}`}` };
      }
    }
    return r;
  } catch (err) {
    console.error('ERROR in emitNfseAction:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'Falha inesperada ao emitir a nota.' };
  }
}

/** Dados públicos do CNPJ para completar o cliente no formulário. */
export async function consultarCnpjAction(cnpj: string) {
  await getTenantContext();
  return consultarCnpj(cnpj);
}

export async function cancelNfseAction(id: string, protocol: string): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await getTenantContext();
    const service = await makeServiceInvoiceServiceReadOnly(ctx);
    await service.cancel(ctx, id, protocol);
    revalidatePath('/meu-negocio/notas');
    return { ok: true, message: 'Nota cancelada.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao cancelar.' };
  }
}

export async function refreshNfseStatusAction(id: string, protocol: string): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await getTenantContext();
    const service = await makeServiceInvoiceServiceReadOnly(ctx);
    const newStatus = await service.refreshStatus(ctx, id, protocol);
    revalidatePath('/meu-negocio/notas');
    return { ok: true, message: newStatus };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao consultar status.' };
  }
}
