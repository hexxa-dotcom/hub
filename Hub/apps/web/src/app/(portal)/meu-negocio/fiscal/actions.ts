'use server';

import { revalidatePath } from 'next/cache';
import { getTenantContext } from '@/lib/server/tenant';
import { saveNfseConfig, getNfseConfig } from '@/lib/server/fiscal';
import { loadCertFromBase64 } from '@hexxa/integrations';

export type FiscalState = { ok: boolean; message: string };

export async function saveFiscalAction(_prev: FiscalState, formData: FormData): Promise<FiscalState> {
  const str = (k: string) => {
    const v = String(formData.get(k) ?? '').trim();
    return v || undefined;
  };
  try {
    const aliquotaRaw = str('aliquota');
    const ctx = await getTenantContext();

    // Remove pontuação do CNPJ antes de salvar
    const cnpjRaw = str('cnpj');
    const cnpj = cnpjRaw ? cnpjRaw.replace(/\D/g, '') : undefined;

    await saveNfseConfig(ctx, {
      ambiente: String(formData.get('ambiente')) === 'producao' ? 'producao' : 'homologacao',
      cnpj,
      razaoSocial: str('razao'),
      nomeFantasia: str('nomeFantasia'),
      inscricaoMunicipal: str('im'),
      codigoMunicipio: str('cmun')?.replace(/\D/g, '') ?? null,
      regimeApuracao: str('regimeApuracao'),
      optanteSimples: ['2', '3'].includes(str('regimeApuracao') || ''),
      emitirExterior: formData.get('emitirExterior') === 'on',
      regimeEspecial: str('regimeEspecial') ?? undefined,
      // Endereço
      cep: str('cep')?.replace(/\D/g, '') ?? null,
      logradouro: str('logradouro'),
      numero: str('numero'),
      complemento: str('complemento'),
      bairro: str('bairro'),
      uf: str('uf'),
      // Contato
      emailContato: str('emailContato'),
      telefone: str('telefone'),
      // Serviço
      itemListaServico: str('item'),
      codigoTributacaoMunicipio: str('ctrib'),
      cnae: str('cnae'),
      aliquotaIss: aliquotaRaw ? Number(aliquotaRaw.replace(',', '.')) : null,
    });

    revalidatePath('/meu-negocio/notas');
    revalidatePath('/configuracoes/fiscal');
    return { ok: true, message: 'Cadastro fiscal salvo com sucesso.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}

export async function saveTecnicaAction(_prev: FiscalState, formData: FormData): Promise<FiscalState> {
  try {
    const ctx = await getTenantContext();
    const str = (key: string) => (formData.get(key) as string)?.trim() || null;
    const proxRaw = str('proxNumeroDps');

    await saveNfseConfig(ctx, {
      serieDps: str('serie') ?? '00001',
      proxNumeroDps: proxRaw ? parseInt(proxRaw, 10) : 1,
    });

    revalidatePath('/meu-negocio/notas');
    revalidatePath('/configuracoes/fiscal');
    return { ok: true, message: 'Configuração técnica salva com sucesso.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar.' };
  }
}

export async function uploadCertAction(_prev: FiscalState, formData: FormData): Promise<FiscalState> {
  try {
    const file = formData.get('pfx') as File | null;
    const senha = String(formData.get('certSenha') ?? '').trim();

    if (!file || file.size === 0) return { ok: false, message: 'Selecione o arquivo .pfx do certificado.' };
    if (!senha) return { ok: false, message: 'Informe a senha do certificado.' };
    if (!file.name.match(/\.(pfx|p12)$/i)) return { ok: false, message: 'O arquivo deve ser .pfx ou .p12.' };
    if (file.size > 1024 * 1024) return { ok: false, message: 'Arquivo muito grande (máx. 1 MB).' };

    const buffer = await file.arrayBuffer();
    const b64 = Buffer.from(buffer).toString('base64');

    // Valida antes de salvar
    try {
      loadCertFromBase64(b64, senha);
    } catch {
      return { ok: false, message: 'Certificado ou senha inválidos. Verifique o arquivo .pfx e a senha.' };
    }

    const ctx = await getTenantContext();
    await saveNfseConfig(ctx, { certPfxB64: b64, certPassword: senha });

    revalidatePath('/meu-negocio/notas');
    revalidatePath('/configuracoes/fiscal');
    return { ok: true, message: 'Certificado A1 salvo e validado com sucesso.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao processar o certificado.' };
  }
}

export async function removeCertAction(): Promise<FiscalState> {
  try {
    const ctx = await getTenantContext();
    await saveNfseConfig(ctx, { certPfxB64: null, certPassword: null });
    revalidatePath('/meu-negocio/notas');
    revalidatePath('/configuracoes/fiscal');
    return { ok: true, message: 'Certificado removido.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao remover.' };
  }
}

export async function getCertStatusAction(): Promise<{ temCert: boolean }> {
  try {
    const ctx = await getTenantContext();
    const cfg = await getNfseConfig(ctx);
    return { temCert: Boolean(cfg?.certPfxB64 && cfg?.certPassword) };
  } catch {
    return { temCert: false };
  }
}

// --- Ações do Perfil Fiscal ---

import { createServiceProfile, updateServiceProfile, deleteServiceProfile } from '@/lib/server/fiscal';

export async function createProfileAction(_prev: FiscalState, formData: FormData): Promise<FiscalState> {
  const str = (k: string) => String(formData.get(k) ?? '').trim() || undefined;
  try {
    const id = str('id');
    const nome = str('nome');
    const item = str('item');
    if (!nome || !item) return { ok: false, message: 'Nome e Código LC 116 são obrigatórios.' };

    const aliquotaRaw = str('aliquota');
    
    const ctx = await getTenantContext();
    const profileData = {
      nome,
      itemListaServico: item,
      codigoTributacaoMunicipio: str('ctrib') ?? null,
      cnae: str('cnae') ?? null,
      aliquotaIss: aliquotaRaw ? Number(aliquotaRaw.replace(',', '.')) : null,
      defaultDescription: str('defaultDescription') ?? null,
    };

    if (id) {
      await updateServiceProfile(ctx, id, profileData);
    } else {
      await createServiceProfile(ctx, profileData);
    }
    
    revalidatePath('/meu-negocio/notas');
    revalidatePath('/configuracoes/fiscal');
    revalidatePath('/meu-negocio/fiscal');
    return { ok: true, message: id ? 'Perfil Fiscal atualizado com sucesso.' : 'Perfil Fiscal criado com sucesso.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao salvar perfil.' };
  }
}

export async function deleteProfileAction(id: string): Promise<FiscalState> {
  try {
    const ctx = await getTenantContext();
    await deleteServiceProfile(ctx, id);
    revalidatePath('/meu-negocio/notas');
    revalidatePath('/configuracoes/fiscal');
    revalidatePath('/meu-negocio/fiscal');
    return { ok: true, message: 'Perfil removido.' };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Falha ao remover perfil.' };
  }
}
