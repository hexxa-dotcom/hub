'use server';

import { revalidatePath } from 'next/cache';
import { makeServiceInvoiceService, serviceInvoiceRepository, resolveNfsePort } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, estimateInvoiceTaxRate, listServiceProfiles } from '@/lib/server/fiscal';

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
};

export async function emitNfseAction(_prev: EmitState, formData: FormData): Promise<EmitState> {
  try {
    const rawAmount = String(formData.get('amount') ?? '0');
    const input = {
      customer: {
        name: String(formData.get('customerName') ?? '').trim(),
        document: String(formData.get('customerDocument') ?? '').replace(/\D/g, ''),
        email: String(formData.get('customerEmail') ?? '').trim() || undefined,
        address: formData.get('cMun') ? {
          cep: String(formData.get('cep') ?? '').replace(/\D/g, ''),
          cMun: String(formData.get('cMun') ?? '').replace(/\D/g, ''),
          logradouro: String(formData.get('logradouro') ?? '').trim(),
          numero: String(formData.get('numero') ?? '').trim(),
          complemento: String(formData.get('complemento') ?? '').trim() || undefined,
          bairro: String(formData.get('bairro') ?? '').trim(),
        } : undefined,
      },
      amount: parseFloat(rawAmount.replace(',', '.')) || 0,
      serviceDescription: (() => {
        const desc = String(formData.get('serviceDescription') ?? '').trim();
        const info = String(formData.get('additionalInfo') ?? '').trim();
        return info ? `${desc}\n\nInformações Adicionais:\n${info}` : desc;
      })(),
      referenceMonth: String(formData.get('competenciaDate') ?? '').slice(0, 7),
      competenciaDate: String(formData.get('competenciaDate') ?? ''),
      retainIss: formData.get('retainIss') === 'on',
      serviceOverride: undefined as any,
    };

    const profileId = String(formData.get('profileId') ?? '');
    const ctx = await getTenantContext();
    const profiles = await listServiceProfiles(ctx);

    let selectedProfile = profiles.find(p => p.id === profileId);

    if (!selectedProfile) {
      if (profiles.length === 1) {
        selectedProfile = profiles[0];
      } else if (profiles.length > 1) {
        return { ok: false, message: 'Selecione um Perfil Fiscal de Serviço.' };
      } else {
        return { ok: false, message: 'Cadastre pelo menos um Perfil Fiscal nas configurações.' };
      }
    }

    const cfg = await getNfseConfig(ctx);
    if (!cfg) return { ok: false, message: 'Cadastro fiscal incompleto.' };

    const profile = selectedProfile!;
    input.serviceOverride = {
      itemListaServico: profile.itemListaServico,
      codigoTributacaoMunicipio: profile.codigoTributacaoMunicipio ?? undefined,
      aliquotaIss: profile.aliquotaIss ?? undefined,
      cnae: profile.cnae ?? undefined,
    };

    // --- CÁLCULO DE IMPOSTO (Integração Financeira) ---
    const taxRate = await estimateInvoiceTaxRate(ctx, cfg, profile.aliquotaIss);
    const estimatedTaxAmount = (input.amount * taxRate) / 100;

    (input as any).estimatedTaxAmount = estimatedTaxAmount;
    (input as any).estimatedTaxRate = taxRate;

    if (!input.customer.name) return { ok: false, message: 'Informe o nome do tomador.' };
    if (input.customer.document.length < 11) return { ok: false, message: 'CPF ou CNPJ inválido.' };
    if (!input.amount || input.amount <= 0) return { ok: false, message: 'Informe um valor válido.' };
    if (!input.serviceDescription) return { ok: false, message: 'Descreva o serviço prestado.' };
    if (!input.referenceMonth) return { ok: false, message: 'Informe o mês de referência.' };
    const service = await makeServiceInvoiceService(ctx);
    const result = await service.emit(ctx, input);

    revalidatePath('/meu-negocio/notas');
    revalidatePath('/cliente');

    if (result.status === 'ERROR') {
      return { ok: false, message: 'Erro na emissão junto ao Emissor Nacional. Verifique o cadastro fiscal.' };
    }

    if (result.status === 'ISSUING') {
      return {
        ok: true,
        status: 'ISSUING',
        message: 'Nota enviada ao Emissor Nacional e aguardando processamento. Acompanhe o status na lista abaixo.',
        taxAmount: estimatedTaxAmount,
        taxRate,
        netAmount: input.amount - estimatedTaxAmount,
        invoiceId: result.invoiceId,
        providerProtocol: result.providerProtocol,
      };
    }

    return {
      ok: true,
      status: 'ISSUED',
      nfseNumber: result.nfseNumber,
      taxAmount: estimatedTaxAmount,
      taxRate,
      netAmount: input.amount - estimatedTaxAmount,
      invoiceId: result.invoiceId,
      providerProtocol: result.providerProtocol,
      message: result.isMock
        ? `[MODO TESTE] NFSe${result.nfseNumber ? ` nº ${result.nfseNumber}` : ''} salva, mas NÃO foi enviada ao governo — configure o certificado A1 para emissão real.`
        : `NFSe${result.nfseNumber ? ` nº ${result.nfseNumber}` : ''} autorizada com sucesso!`,
    };
  } catch (err) {
    console.error('ERROR in emitNfseAction:', err);
    return { ok: false, message: err instanceof Error ? err.message : 'Falha inesperada ao emitir a NFSe.' };
  }
}

export async function cancelNfseAction(id: string, protocol: string): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await getTenantContext();
    const port = await resolveNfsePort(ctx);
    await port.cancel(protocol, 'Cancelamento solicitado pelo emitente');
    await serviceInvoiceRepository.updateStatus(ctx, id, { status: 'CANCELED' });
    revalidatePath('/meu-negocio/notas');
    return { ok: true, message: 'Nota cancelada.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao cancelar.' };
  }
}

export async function refreshNfseStatusAction(id: string, protocol: string): Promise<{ ok: boolean; message: string }> {
  try {
    const ctx = await getTenantContext();
    const port = await resolveNfsePort(ctx);
    const result = await port.getStatus(protocol);
    if (result.status !== 'ISSUING') {
      await serviceInvoiceRepository.updateStatus(ctx, id, {
        status: result.status,
        nfseNumber: result.nfseNumber,
      });
    }
    revalidatePath('/meu-negocio/notas');
    return { ok: true, message: result.status };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao consultar status.' };
  }
}
