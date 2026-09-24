'use server';

import { getTenantContext } from '@/lib/server/tenant';
import { getNfseConfig, saveNfseConfig } from '@/lib/server/fiscal';
import { lerConfigDaNfse, inspecionarCertificado } from '@hexxa/integrations';
import { withTenant, eq, and, sql } from '@hexxa/db';
import { ticket, ticketMessage } from '@hexxa/db/schema';
import { aplicarConfigDaNota, configurarPelaUltimaNota, type ResultadoDoPerfil } from '@/lib/server/perfil-de-servico';
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
    const codigoTributacaoMunicipio = String(formData.get('codigoTributacaoMunicipio') ?? '').trim() || null;
    await saveNfseConfig(ctx, { itemListaServico: item, aliquotaIss: aliquota, codigoTributacaoMunicipio });
    // O serviço confirmado aqui vira o perfil padrão de emissão.
    await aplicarConfigDaNota(ctx, {
      itemListaServico: item,
      aliquotaIss: aliquota,
      codigoTributacaoMunicipio,
      descricaoServico: String(formData.get('descricaoServico') ?? '').trim() || null,
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

/**
 * Caminho 1: o certificado digital. Com ele, nada mais precisa ser enviado —
 * a Hexx busca no Emissor Nacional as notas que a empresa já emitiu e monta o
 * perfil pela última. E o faturamento passa a chegar sozinho, todo dia.
 */
export async function enviarCertificado(
  _prev: ResultadoDoPerfil,
  formData: FormData,
): Promise<ResultadoDoPerfil> {
  const ctx = await getTenantContext();
  const arquivo = formData.get('pfx');
  const senha = String(formData.get('senha') ?? '').trim();
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, message: 'Escolha o arquivo .pfx do certificado.' };
  if (!/\.(pfx|p12)$/i.test(arquivo.name)) return { ok: false, message: 'O certificado é um arquivo .pfx ou .p12.' };
  if (arquivo.size > 1024 * 1024) return { ok: false, message: 'Arquivo grande demais para um certificado.' };
  if (!senha) return { ok: false, message: 'Informe a senha do certificado.' };

  const b64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');
  let ficha;
  try {
    ficha = inspecionarCertificado(b64, senha);
  } catch {
    return { ok: false, message: 'Não consegui abrir o certificado. Confira a senha.' };
  }
  const cfg = await getNfseConfig(ctx).catch(() => null);
  const daEmpresa = normalizeDocument(cfg?.cnpj ?? '');
  if (ficha.cnpj && daEmpresa && ficha.cnpj !== daEmpresa) {
    return { ok: false, message: `Este certificado é de outro CNPJ (${ficha.cnpj}). Envie o da sua empresa.` };
  }
  if (ficha.vencido) return { ok: false, message: `Este certificado venceu em ${ficha.validoAte}.` };

  await saveNfseConfig(ctx, { certPfxB64: b64, certPassword: senha });
  const resultado = await configurarPelaUltimaNota(ctx);
  revalidatePath('/cliente');
  // O certificado ficou salvo mesmo que a busca da nota falhe: a tela oferece
  // o XML como alternativa, e o faturamento automático já passa a funcionar.
  return resultado.ok
    ? resultado
    : { ...resultado, message: `Certificado salvo. ${resultado.message}` };
}

const ASSUNTO_PRIMEIRA_NOTA = 'Configurar a emissão de nota fiscal';

/**
 * Caminho 3: nunca emitiu nota. Não há de onde copiar — quem configura é o
 * contador, que também cuida do certificado. Abre um chamado para ele, uma
 * vez só: clicar de novo não duplica.
 */
export async function pedirAoContador(): Promise<{ ok: boolean; message: string }> {
  const ctx = await getTenantContext();
  await withTenant(ctx.companyId, async (tx) => {
    const [aberto] = await tx
      .select({ id: ticket.id })
      .from(ticket)
      .where(and(eq(ticket.companyId, ctx.companyId), eq(ticket.subject, ASSUNTO_PRIMEIRA_NOTA), sql`${ticket.status} NOT IN ('CLOSED', 'RESOLVED')`));
    if (aberto) return;
    const [criado] = await tx
      .insert(ticket)
      .values({ companyId: ctx.companyId, subject: ASSUNTO_PRIMEIRA_NOTA, category: 'FISCAL', priority: 'HIGH', status: 'OPEN' })
      .returning({ id: ticket.id });
    await tx.insert(ticketMessage).values({
      ticketId: criado!.id,
      sender: 'CLIENT',
      body:
        'Empresa nova, sem nota emitida. Providenciar o certificado digital e configurar a emissão (serviço, alíquota de ISS e código municipal).',
    });
  });
  revalidatePath('/contador/solicitacoes');
  return { ok: true, message: 'Tudo certo. Seu contador vai providenciar o certificado e a configuração para você emitir nota o quanto antes.' };
}
