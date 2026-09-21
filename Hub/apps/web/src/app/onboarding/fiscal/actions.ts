'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, saveNfseConfig } from '@/lib/server/fiscal';
import { revalidatePath } from 'next/cache';

export type EstadoFiscal = { ok: boolean; message: string };

/**
 * Passo 2: o que você vende, e quanto o município cobra por isso.
 *
 * ── Por que só dois campos ─────────────────────────────────────────────
 *
 * O resto do cadastro fiscal — CNPJ, município, endereço, CNAE, Simples — já
 * foi preenchido no passo 1 a partir da Receita. Repetir isso aqui seria
 * pedir à pessoa que confirmasse o que ela nem digitou.
 *
 * O que a Receita NÃO sabe são estes dois: o item da lista de serviços da LC
 * 116 (o CNAE se parece, mas não é a mesma lista) e a alíquota de ISS, que é
 * lei municipal e varia de 2% a 5% na mesma cidade conforme o serviço.
 *
 * ── Por que o certificado não está aqui ────────────────────────────────
 *
 * Porque ele não é preciso para configurar, só para emitir — e exigir um .pfx
 * no primeiro acesso é onde a pessoa para, vai procurar o arquivo, e não
 * volta. O aviso de que ele falta aparece na hora de emitir a primeira nota,
 * que é quando ele realmente importa.
 */
export async function salvarFiscal(
  _prev: EstadoFiscal,
  formData: FormData,
): Promise<EstadoFiscal> {
  const ctx = await getTenantContext();

  const item = String(formData.get('itemListaServico') ?? '').trim();
  const aliquotaTexto = String(formData.get('aliquotaIss') ?? '')
    .replace(',', '.')
    .replace('%', '')
    .trim();
  const aliquota = Number(aliquotaTexto);

  if (!item) {
    return { ok: false, message: 'Informe o item da lista de serviços (LC 116).' };
  }
  if (!Number.isFinite(aliquota) || aliquota < 0 || aliquota > 5) {
    // O teto constitucional do ISS é 5%; o piso, 2%. Fora disso é erro de
    // digitação, e uma alíquota errada aqui vira imposto errado em toda nota.
    return { ok: false, message: 'A alíquota do ISS fica entre 0% e 5%. Confira o valor.' };
  }

  try {
    await saveNfseConfig(ctx, {
      itemListaServico: item,
      aliquotaIss: aliquota,
      codigoTributacaoMunicipio:
        String(formData.get('codigoTributacaoMunicipio') ?? '').trim() || null,
    });
  } catch (err) {
    console.error('[onboarding/fiscal] falhou:', err);
    return { ok: false, message: 'Não consegui gravar a configuração fiscal.' };
  }

  revalidatePath('/cliente');
  return { ok: true, message: 'Nota fiscal configurada.' };
}

export async function lerFiscal() {
  const ctx = await getTenantContext();
  const cfg = await getNfseConfig(ctx).catch(() => null);
  return {
    razaoSocial: cfg?.razaoSocial ?? null,
    municipio: cfg?.codigoMunicipio ?? null,
    cnae: cfg?.cnae ?? null,
    optanteSimples: cfg?.optanteSimples ?? false,
    itemListaServico: cfg?.itemListaServico ?? '',
    aliquotaIss: cfg?.aliquotaIss ?? null,
    codigoTributacaoMunicipio: cfg?.codigoTributacaoMunicipio ?? '',
  };
}
