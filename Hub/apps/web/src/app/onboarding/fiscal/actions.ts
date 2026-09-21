'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, saveNfseConfig } from '@/lib/server/fiscal';
import { lerConfigDaNfse } from '@hexxa/integrations';
import { normalizeDocument } from '@hexxa/core/document-br';
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

/**
 * A última nota emitida preenche o passo inteiro.
 *
 * O que este passo pede já está dentro de qualquer nota que a empresa emitiu.
 * Pedir para digitar é pedir que a pessoa procure numa nota antiga e copie à
 * mão — com chance de errar um dígito que vira imposto errado em todas as
 * notas seguintes.
 *
 * Só XML: o do Padrão Nacional tem estrutura definida em schema, e ler é
 * determinístico. PDF é desenho, cada prefeitura faz o seu, e adivinhar dado
 * fiscal é pior que perguntar.
 */
export async function lerNotaEnviada(
  _prev: EstadoDaLeitura,
  formData: FormData,
): Promise<EstadoDaLeitura> {
  const ctx = await getTenantContext();
  const arquivo = formData.get('nota');

  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, message: 'Escolha o arquivo XML da nota.', lido: null };
  }
  if (arquivo.size > 2_000_000) {
    return { ok: false, message: 'Arquivo grande demais para ser uma NFS-e.', lido: null };
  }

  const texto = await arquivo.text();
  if (!/<(?:\w+:)?(?:NFSe|DPS)\b/.test(texto)) {
    return {
      ok: false,
      message: 'Não parece o XML de uma NFS-e. Se você tem só o PDF, preencha abaixo à mão.',
      lido: null,
    };
  }

  const lido = lerConfigDaNfse(texto);
  const cfg = await getNfseConfig(ctx).catch(() => null);

  /**
   * A nota é desta empresa?
   *
   * Subir a nota de outro CNPJ — de um cliente, de outra empresa da pessoa —
   * gravaria a alíquota e o item de serviço ERRADOS, e ninguém perceberia até
   * a primeira emissão sair com imposto que não é o dela.
   */
  const daEmpresa = normalizeDocument(cfg?.cnpj ?? '');
  if (lido.prestadorCnpj && daEmpresa && lido.prestadorCnpj !== daEmpresa) {
    return {
      ok: false,
      message: `Esta nota foi emitida por outro CNPJ (${lido.prestadorCnpj}). Envie uma nota da sua empresa.`,
      lido: null,
    };
  }

  if (!lido.itemListaServico && lido.aliquotaIss === null) {
    return {
      ok: false,
      message: 'Li o arquivo, mas ele não traz o item de serviço nem a alíquota. Preencha abaixo.',
      lido: null,
    };
  }

  return {
    ok: true,
    message: lido.numeroNota
      ? `Nota ${lido.numeroNota} lida. Confira os campos abaixo antes de salvar.`
      : 'Nota lida. Confira os campos abaixo antes de salvar.',
    lido: {
      itemListaServico: lido.itemListaServico,
      aliquotaIss: lido.aliquotaIss,
      codigoTributacaoMunicipio: lido.codigoTributacaoMunicipio,
      descricaoServico: lido.descricaoServico,
    },
  };
}

export type EstadoDaLeitura = {
  ok: boolean;
  message: string;
  lido: {
    itemListaServico: string | null;
    aliquotaIss: number | null;
    codigoTributacaoMunicipio: string | null;
    descricaoServico: string | null;
  } | null;
};
