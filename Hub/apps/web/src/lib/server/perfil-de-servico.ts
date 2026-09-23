import 'server-only';
import type { TenantContext } from '@hexxa/core';
import { normalizeDocument } from '@hexxa/core/document-br';
import { fetchXmlDaNotaPorNsu, lerConfigDaNfse, type ConfigDaNfse } from '@hexxa/integrations';
import { withTenant, sql } from '@hexxa/db';
import {
  getNfseConfig,
  saveNfseConfig,
  getCertForTenant,
  listServiceProfiles,
  createServiceProfile,
  updateServiceProfile,
} from './fiscal';
import { syncDistribuicaoDfe } from './nfse-dfe-sync';

/**
 * O PERFIL DE SERVIÇO NASCE DE UMA NOTA DE VERDADE.
 *
 * ── O que é um perfil ──────────────────────────────────────────────────
 *
 * Um serviço que a empresa presta, com o item da LC 116, a alíquota de ISS e
 * o código municipal que valem para ele. Quase toda empresa emite sempre o
 * mesmo serviço: o primeiro perfil é o padrão, e fica também gravado no
 * cadastro fiscal. Um serviço diferente, com outro item, vira outro perfil.
 *
 * ── Por que de uma nota, e não de um formulário ────────────────────────
 *
 * Esses três dados estão em qualquer nota que a empresa já emitiu, aceitos
 * pela prefeitura. Pedir para digitar é pedir que a pessoa copie à mão de uma
 * nota antiga — e um dígito errado vira imposto errado em toda nota seguinte.
 */

export type ResultadoDoPerfil = {
  ok: boolean;
  message: string;
  /** O que foi lido da nota, para a tela mostrar o que foi configurado. */
  lido?: Pick<ConfigDaNfse, 'itemListaServico' | 'aliquotaIss' | 'codigoTributacaoMunicipio' | 'descricaoServico' | 'numeroNota'>;
  perfil?: { nome: string; criado: boolean };
};

/** Descrição que não serve de nome: nota de teste, ou texto longo demais. */
function nomeDoPerfil(item: string, descricao: string | null): string {
  const d = (descricao ?? '').replace(/\*/g, '').trim();
  if (!d || /teste/i.test(d) || d.length > 60) return `Serviço ${item}`;
  return d;
}

/**
 * Grava a configuração lida de uma nota: cadastro fiscal (o padrão) e um
 * perfil de serviço — só se ainda não houver um para o mesmo item.
 */
export async function aplicarConfigDaNota(
  ctx: TenantContext,
  lido: Pick<ConfigDaNfse, 'itemListaServico' | 'aliquotaIss' | 'codigoTributacaoMunicipio' | 'descricaoServico'>,
): Promise<{ nome: string; criado: boolean } | null> {
  if (!lido.itemListaServico) return null;

  const [perfis, cfg] = await Promise.all([listServiceProfiles(ctx), getNfseConfig(ctx).catch(() => null)]);
  // O cadastro fiscal guarda o serviço padrão. Só o primeiro perfil o define —
  // uma segunda nota, de outro serviço, não troca o padrão de quem já tem um —,
  // a não ser que o padrão esteja incompleto, e aí a nota o completa.
  const padraoIncompleto = !cfg?.itemListaServico || cfg.aliquotaIss == null;
  if (perfis.length === 0 || padraoIncompleto) {
    await saveNfseConfig(ctx, {
      itemListaServico: lido.itemListaServico,
      aliquotaIss: lido.aliquotaIss,
      codigoTributacaoMunicipio: lido.codigoTributacaoMunicipio,
    });
  }

  const existente = perfis.find((p) => p.itemListaServico === lido.itemListaServico);
  if (existente) return { nome: existente.nome, criado: false };

  // "17.02" e "17.02.02" são o mesmo serviço: o segundo é o código nacional
  // exato que a prefeitura aceitou. O perfil digitado sem a variação vira o
  // código genérico "170200" na emissão, que pode nem existir na tabela
  // nacional — então a nota corrige o perfil, em vez de criar um repetido.
  const generico = perfis.find((p) => lido.itemListaServico!.startsWith(`${p.itemListaServico}.`));
  if (generico) {
    await updateServiceProfile(ctx, generico.id, {
      nome: generico.nome,
      itemListaServico: lido.itemListaServico,
      codigoTributacaoMunicipio: generico.codigoTributacaoMunicipio ?? lido.codigoTributacaoMunicipio,
      cnae: generico.cnae,
      aliquotaIss: generico.aliquotaIss ?? lido.aliquotaIss,
      defaultDescription: generico.defaultDescription,
    });
    return { nome: generico.nome, criado: false };
  }

  const nome = nomeDoPerfil(lido.itemListaServico, lido.descricaoServico);
  const descricao = (lido.descricaoServico ?? '').replace(/\*/g, '').trim();
  await createServiceProfile(ctx, {
    nome,
    itemListaServico: lido.itemListaServico,
    codigoTributacaoMunicipio: lido.codigoTributacaoMunicipio,
    cnae: null,
    aliquotaIss: lido.aliquotaIss,
    defaultDescription: descricao && !/teste/i.test(descricao) ? descricao : null,
  });
  return { nome, criado: true };
}

/**
 * Com o certificado, a empresa não precisa subir nota nenhuma: o Hub busca no
 * Emissor Nacional tudo o que ela emitiu (o que também traz o faturamento),
 * pega a última nota e monta o perfil a partir dela.
 */
export async function configurarPelaUltimaNota(ctx: TenantContext): Promise<ResultadoDoPerfil> {
  const cfg = await getNfseConfig(ctx);
  const cert = await getCertForTenant(ctx);
  if (!cfg?.cnpj || !cert) {
    return { ok: false, message: 'Envie o certificado digital da empresa primeiro.' };
  }

  const sync = await syncDistribuicaoDfe(ctx);
  if (sync.erro) {
    return { ok: false, message: `Não consegui consultar o Emissor Nacional: ${sync.erro}` };
  }

  const [ultima] = (await withTenant(ctx.companyId, (tx) =>
    tx.execute(sql`
      SELECT nsu FROM nfse_distribuicao_doc
       WHERE company_id = ${ctx.companyId}
         AND tipo_documento = 'NFSE' AND direction = 'EMITIDA' AND cancelado = false
       ORDER BY data_emissao DESC NULLS LAST, nsu DESC
       LIMIT 1
    `),
  )) as unknown as { nsu: string | number }[];

  if (!ultima) {
    return {
      ok: false,
      message:
        'O certificado está certo, mas o Emissor Nacional não tem nenhuma nota emitida por esta empresa. Envie o XML da última nota, ou avise que nunca emitiu.',
    };
  }

  const xml = await fetchXmlDaNotaPorNsu(cert, cfg.ambiente, cfg.cnpj, Number(ultima.nsu));
  if (!xml) return { ok: false, message: 'Achei a última nota, mas não consegui baixar o XML dela. Tente de novo.' };

  const lido = lerConfigDaNfse(xml);
  if (lido.prestadorCnpj && lido.prestadorCnpj !== normalizeDocument(cfg.cnpj)) {
    return { ok: false, message: 'A última nota encontrada não foi emitida por esta empresa.' };
  }
  if (!lido.itemListaServico) {
    return { ok: false, message: 'Li a última nota, mas ela não traz o item de serviço. Preencha à mão.' };
  }

  const perfil = await aplicarConfigDaNota(ctx, lido);
  return {
    ok: true,
    message: `Configurado a partir da nota ${lido.numeroNota ?? ''} do Emissor Nacional.`.replace('  ', ' '),
    lido,
    perfil: perfil ?? undefined,
  };
}
