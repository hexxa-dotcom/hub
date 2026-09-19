import 'server-only';
import { cache } from 'react';
import type { TenantContext } from '@hexxa/core';
import { loadCertFromBase64, type CertMaterial } from '@hexxa/integrations';
import { withTenant, getDb, sql } from '@hexxa/db';
import { encryptSecret, decryptSecret } from './secret-crypto';

export interface NfseConfig {
  ambiente: 'homologacao' | 'producao';
  cnpj: string | null;
  razaoSocial: string | null;
  nomeFantasia: string | null;
  inscricaoMunicipal: string | null;
  codigoMunicipio: string | null;
  optanteSimples: boolean;
  regimeEspecial?: string;
  regimeApuracao?: string;
  emitirExterior: boolean;
  // Endereço (usado pelo Emissor Nacional no emit; não vai no DPS que enviamos)
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  uf: string | null;
  // Contato
  emailContato: string | null;
  telefone: string | null;
  // Serviço
  itemListaServico: string | null;
  codigoTributacaoMunicipio: string | null;
  cnae: string | null;
  aliquotaIss: number | null;
  serieDps: string;
  proxNumeroDps: number;
  /** Certificado salvo no banco (base64 do .pfx). Prioritário sobre env var. */
  certPfxB64?: string | null;
  certPassword?: string | null;
  /** Cursor (NSU) da última sincronização com a Distribuição de DF-e do ADN. */
  ultNsuDistribuicao: number;
}

/** cache() deduplica por request — evita reconsultar quando chamada de novo por getCertForTenant/isCertConfiguredForTenant na mesma requisição. */
export const getNfseConfig = cache(async function getNfseConfig(ctx: TenantContext): Promise<NfseConfig | null> {
  return withTenant(ctx.companyId, async (tx) => {
    const res = await tx.execute(sql`
      SELECT * FROM nfse_config WHERE company_id = ${ctx.companyId} LIMIT 1
    `);
    if (res.length === 0) return null;
    const r = res[0]!;
    return {
      ambiente: (r.ambiente as 'homologacao' | 'producao') ?? 'homologacao',
      cnpj: (r.cnpj as string) ?? null,
      razaoSocial: (r.razao_social as string) ?? null,
      nomeFantasia: (r.nome_fantasia as string) ?? null,
      inscricaoMunicipal: (r.inscricao_municipal as string) ?? null,
      codigoMunicipio: (r.codigo_municipio as string) ?? null,
      optanteSimples: Boolean(r.optante_simples),
      regimeEspecial: (r.regime_especial as string) ?? undefined,
      regimeApuracao: (r.regime_apuracao as string) ?? undefined,
      emitirExterior: Boolean(r.emitir_exterior),
      cep: (r.cep as string) ?? null,
      logradouro: (r.logradouro as string) ?? null,
      numero: (r.numero as string) ?? null,
      complemento: (r.complemento as string) ?? null,
      bairro: (r.bairro as string) ?? null,
      uf: (r.uf as string) ?? null,
      emailContato: (r.email_contato as string) ?? null,
      telefone: (r.telefone as string) ?? null,
      itemListaServico: (r.item_lista_servico as string) ?? null,
      codigoTributacaoMunicipio: (r.codigo_tributacao_municipio as string) ?? null,
      cnae: (r.cnae as string) ?? null,
      aliquotaIss: r.aliquota_iss != null ? Number(r.aliquota_iss) : null,
      serieDps: (r.serie_dps as string) ?? '00001',
      proxNumeroDps: (r.prox_numero_dps as number) ?? 1,
      certPfxB64: decryptSecret(r.cert_pfx_b64 as string | null),
      certPassword: decryptSecret(r.cert_password as string | null),
      ultNsuDistribuicao: Number(r.ult_nsu_distribuicao ?? 0),
    };
  });
});

export async function saveNfseConfig(ctx: TenantContext, input: Partial<NfseConfig>): Promise<void> {
  await withTenant(ctx.companyId, async (tx) => {
    // Busca a config atual
    const res = await tx.execute(sql`SELECT * FROM nfse_config WHERE company_id = ${ctx.companyId} LIMIT 1`);
    const existing = res.length > 0 ? res[0] : null;

    // Prepara os valores atualizados
    const ambiente = input.ambiente !== undefined ? input.ambiente : (existing?.ambiente ?? 'homologacao');
    const cnpj = input.cnpj !== undefined ? input.cnpj : existing?.cnpj;
    const razaoSocial = input.razaoSocial !== undefined ? input.razaoSocial : existing?.razao_social;
    const nomeFantasia = input.nomeFantasia !== undefined ? input.nomeFantasia : existing?.nome_fantasia;
    const inscricaoMunicipal = input.inscricaoMunicipal !== undefined ? input.inscricaoMunicipal : existing?.inscricao_municipal;
    const codigoMunicipio = input.codigoMunicipio !== undefined ? input.codigoMunicipio : existing?.codigo_municipio;
    const optanteSimples = input.optanteSimples !== undefined ? input.optanteSimples : (existing?.optante_simples ?? false);
    const regimeEspecial = input.regimeEspecial !== undefined ? input.regimeEspecial : existing?.regime_especial;
    const regimeApuracao = input.regimeApuracao !== undefined ? input.regimeApuracao : existing?.regime_apuracao;
    const emitirExterior = input.emitirExterior !== undefined ? input.emitirExterior : (existing?.emitir_exterior ?? false);
    const cep = input.cep !== undefined ? input.cep : existing?.cep;
    const logradouro = input.logradouro !== undefined ? input.logradouro : existing?.logradouro;
    const numero = input.numero !== undefined ? input.numero : existing?.numero;
    const complemento = input.complemento !== undefined ? input.complemento : existing?.complemento;
    const bairro = input.bairro !== undefined ? input.bairro : existing?.bairro;
    const uf = input.uf !== undefined ? input.uf : existing?.uf;
    const emailContato = input.emailContato !== undefined ? input.emailContato : existing?.email_contato;
    const telefone = input.telefone !== undefined ? input.telefone : existing?.telefone;
    const itemListaServico = input.itemListaServico !== undefined ? input.itemListaServico : existing?.item_lista_servico;
    const codigoTributacaoMunicipio = input.codigoTributacaoMunicipio !== undefined ? input.codigoTributacaoMunicipio : existing?.codigo_tributacao_municipio;
    const cnae = input.cnae !== undefined ? input.cnae : existing?.cnae;
    const aliquotaIss = input.aliquotaIss !== undefined ? input.aliquotaIss : existing?.aliquota_iss;
    const serieDps = input.serieDps !== undefined ? input.serieDps : (existing?.serie_dps ?? '00001');
    const proxNumeroDps = input.proxNumeroDps !== undefined ? input.proxNumeroDps : (existing?.prox_numero_dps ?? 1);
    // Certificado/senha: se vier um valor novo no input, criptografa antes
    // de gravar; se não veio (input undefined), mantém o valor já
    // criptografado que já estava no banco — nunca re-criptografa o que já
    // está criptografado, e nunca grava segredo em texto puro.
    const certPfxB64 = input.certPfxB64 !== undefined
      ? (input.certPfxB64 ? encryptSecret(input.certPfxB64) : null)
      : existing?.cert_pfx_b64;
    const certPassword = input.certPassword !== undefined
      ? (input.certPassword ? encryptSecret(input.certPassword) : null)
      : existing?.cert_password;

    if (existing) {
      await tx.execute(sql`
        UPDATE nfse_config SET
          ambiente = ${ambiente}, cnpj = ${cnpj || null}, razao_social = ${razaoSocial || null},
          nome_fantasia = ${nomeFantasia || null}, inscricao_municipal = ${inscricaoMunicipal || null},
          codigo_municipio = ${codigoMunicipio || null}, optante_simples = ${optanteSimples},
          regime_especial = ${regimeEspecial || null}, regime_apuracao = ${regimeApuracao || null},
          emitir_exterior = ${emitirExterior}, cep = ${cep || null}, logradouro = ${logradouro || null},
          numero = ${numero || null}, complemento = ${complemento || null}, bairro = ${bairro || null},
          uf = ${uf || null}, email_contato = ${emailContato || null}, telefone = ${telefone || null},
          item_lista_servico = ${itemListaServico || null}, codigo_tributacao_municipio = ${codigoTributacaoMunicipio || null},
          cnae = ${cnae || null}, aliquota_iss = ${aliquotaIss || null}, serie_dps = ${serieDps},
          prox_numero_dps = ${proxNumeroDps}, cert_pfx_b64 = ${certPfxB64 || null}, cert_password = ${certPassword || null},
          updated_at = now()
        WHERE company_id = ${ctx.companyId}
      `);
    } else {
      await tx.execute(sql`
        INSERT INTO nfse_config (
          company_id, ambiente, cnpj, razao_social, nome_fantasia, inscricao_municipal, codigo_municipio,
          optante_simples, regime_especial, regime_apuracao, emitir_exterior, cep, logradouro,
          numero, complemento, bairro, uf, email_contato, telefone, item_lista_servico,
          codigo_tributacao_municipio, cnae, aliquota_iss, serie_dps, prox_numero_dps, cert_pfx_b64, cert_password
        ) VALUES (
          ${ctx.companyId}, ${ambiente}, ${cnpj || null}, ${razaoSocial || null}, ${nomeFantasia || null},
          ${inscricaoMunicipal || null}, ${codigoMunicipio || null}, ${optanteSimples}, ${regimeEspecial || null},
          ${regimeApuracao || null}, ${emitirExterior}, ${cep || null}, ${logradouro || null}, ${numero || null},
          ${complemento || null}, ${bairro || null}, ${uf || null}, ${emailContato || null}, ${telefone || null},
          ${itemListaServico || null}, ${codigoTributacaoMunicipio || null}, ${cnae || null}, ${aliquotaIss || null},
          ${serieDps}, ${proxNumeroDps}, ${certPfxB64 || null}, ${certPassword || null}
        )
      `);
    }
  });
}

/** Certificado A1: primeiro tenta env var (deploy-wide), depois banco (por tenant). */
export async function getCertForTenant(ctx: TenantContext): Promise<CertMaterial | null> {
  // Env var tem prioridade (configurado no Vercel secrets)
  const envCert = getCert();
  if (envCert) return envCert;

  // Fallback: certificado salvo pelo próprio cliente no banco
  try {
    const cfg = await getNfseConfig(ctx);
    if (cfg?.certPfxB64 && cfg?.certPassword) {
      return loadCertFromBase64(cfg.certPfxB64, cfg.certPassword);
    }
  } catch {
    // cert inválido ou banco indisponível
  }
  return null;
}

/** Certificado do env var (server-only). null se ausente. */
export function getCert(): CertMaterial | null {
  const b64 = process.env.NFSE_CERT_PFX_BASE64;
  const pwd = process.env.NFSE_CERT_PASSWORD;
  if (!b64 || !pwd) return null;
  try {
    return loadCertFromBase64(b64, pwd);
  } catch {
    return null;
  }
}

export function isCertConfigured(): boolean {
  return Boolean(process.env.NFSE_CERT_PFX_BASE64 && process.env.NFSE_CERT_PASSWORD);
}

export async function isCertConfiguredForTenant(ctx: TenantContext): Promise<boolean> {
  if (isCertConfigured()) return true;
  try {
    const cfg = await getNfseConfig(ctx);
    return Boolean(cfg?.certPfxB64 && cfg?.certPassword);
  } catch {
    return false;
  }
}

export function isFiscalComplete(cfg: NfseConfig | null): boolean {
  // Campos mínimos para gerar o DPS no Emissor Nacional.
  // IM não é exigida pelo portal nacional (XML confirmado).
  // Alíquota é calculada pelo município; endereço fica no emit (adicionado pelo portal).
  // itemListaServico agora vem do Perfil Fiscal, portanto, não é obrigatório na config global.
  return Boolean(cfg && cfg.cnpj && cfg.codigoMunicipio);
}

// --- Perfis Fiscais de Serviço ---

export interface NfseServiceProfile {
  id: string;
  companyId: string;
  nome: string;
  itemListaServico: string;
  codigoTributacaoMunicipio: string | null;
  cnae: string | null;
  aliquotaIss: number | null;
  defaultDescription: string | null;
}

export async function listServiceProfiles(ctx: TenantContext): Promise<NfseServiceProfile[]> {
  return withTenant(ctx.companyId, async (tx) => {
    const res = await tx.execute(sql`
      SELECT id, company_id, nome, item_lista_servico, codigo_tributacao_municipio, cnae, aliquota_iss, default_description
      FROM nfse_service_profile
      ORDER BY nome
    `);
    return res.map(r => ({
      id: r.id as string,
      companyId: r.company_id as string,
      nome: r.nome as string,
      itemListaServico: r.item_lista_servico as string,
      codigoTributacaoMunicipio: r.codigo_tributacao_municipio as string | null,
      cnae: r.cnae as string | null,
      aliquotaIss: r.aliquota_iss != null ? Number(r.aliquota_iss) : null,
      defaultDescription: r.default_description as string | null,
    }));
  });
}

export async function createServiceProfile(ctx: TenantContext, input: Omit<NfseServiceProfile, 'id' | 'companyId'>): Promise<void> {
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      INSERT INTO nfse_service_profile (
        company_id, nome, item_lista_servico, codigo_tributacao_municipio, cnae, aliquota_iss, default_description
      ) VALUES (
        ${ctx.companyId},
        ${input.nome},
        ${input.itemListaServico},
        ${input.codigoTributacaoMunicipio || null},
        ${input.cnae || null},
        ${input.aliquotaIss || null},
        ${input.defaultDescription || null}
      )
    `);
  });
}

export async function updateServiceProfile(ctx: TenantContext, id: string, input: Omit<NfseServiceProfile, 'id' | 'companyId'>): Promise<void> {
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      UPDATE nfse_service_profile SET
        nome = ${input.nome},
        item_lista_servico = ${input.itemListaServico},
        codigo_tributacao_municipio = ${input.codigoTributacaoMunicipio || null},
        cnae = ${input.cnae || null},
        aliquota_iss = ${input.aliquotaIss || null},
        default_description = ${input.defaultDescription || null}
      WHERE id = ${id} AND company_id = ${ctx.companyId}
    `);
  });
}

export async function deleteServiceProfile(ctx: TenantContext, id: string): Promise<void> {
  await withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      DELETE FROM nfse_service_profile
      WHERE id = ${id} AND company_id = ${ctx.companyId}
    `);
  });
}

// --- Numeração da DPS e insumos do Simples ---

/**
 * Reserva atomicamente o próximo número de DPS do tenant: incrementa
 * prox_numero_dps e devolve o número reservado para uso imediato.
 * Evita número duplicado entre emissões (inclusive concorrentes).
 */
export async function reserveNextDpsNumber(ctx: TenantContext): Promise<number> {
  return withTenant(ctx.companyId, async (tx) => {
    const res = await tx.execute(sql`
      UPDATE nfse_config
      SET prox_numero_dps = prox_numero_dps + 1, updated_at = now()
      WHERE company_id = ${ctx.companyId}
      RETURNING prox_numero_dps
    `);
    const next = Number(res[0]?.prox_numero_dps ?? 0);
    if (!next) throw new Error('Cadastro fiscal ausente — não foi possível reservar o número da DPS.');
    return next - 1; // número reservado para esta emissão
  });
}

/**
 * RBT12 (receita bruta dos últimos 12 meses) e folha dos últimos 12 meses,
 * para Fator R / faixa do Simples. Janela real de 12 meses, não o histórico todo.
 */
export async function getSimplesInputs(
  ctx: TenantContext,
): Promise<{
  rbt12: number;
  folha12: number;
  folhaEmpregados12: number;
  prolabore12: number;
  /** 'APURADO' = RBT12 da última apuração do OneFlow; 'HUB' = soma dos recebíveis daqui. */
  rbt12Fonte: 'APURADO' | 'HUB';
}> {
  return withTenant(ctx.companyId, async (tx) => {
    // As queries não dependem uma da outra — rodam em paralelo na mesma
    // transação (postgres.js pipeline com segurança dentro de sql.begin).
    const [rbtRes, folhaRes, prolaboreRes, apuradoRes] = await Promise.all([
      tx.execute(sql`
        SELECT coalesce(sum(amount), 0) AS total
        FROM financial_entry
        WHERE company_id = ${ctx.companyId}
          AND type = 'RECEIVABLE'
          AND status != 'CANCELED'
          AND reference_month >= (date_trunc('month', now()) - interval '12 months')::date
          AND reference_month < date_trunc('month', now())::date
      `),
      // Só CLT/Sócio entram na base do Fator R — contratado PJ não conta como folha.
      tx.execute(sql`
        SELECT coalesce(sum(salary), 0) AS total
        FROM employee
        WHERE company_id = ${ctx.companyId} AND status = 'ACTIVE' AND vinculo IN ('CLT', 'Socio')
      `),
      // Fator R = (folha + pró-labore dos sócios) / RBT12 — pró-labore entra na
      // base tanto quanto salário de empregado (LC 123/2006, art. 18, §24).
      tx.execute(sql`
        SELECT coalesce(sum(pro_labore), 0) AS total
        FROM partner
        WHERE company_id = ${ctx.companyId}
      `),
      /**
       * O RBT12 que a apuração oficial usou.
       *
       * A soma dos recebíveis do Hub só enxerga o que passa pelo Hub. Para
       * empresas cuja nota sai pela prefeitura e chega direto ao OneFlow, ela
       * dá zero — e o termômetro dizia "nenhum faturamento nos últimos 12
       * meses" para uma empresa com R$ 85 mil apurados. O de lá prevalece.
       */
      tx.execute(sql`
        SELECT rba12 FROM tax_history
         WHERE company_id = ${ctx.companyId} AND source = 'ONEFLOW'
         ORDER BY reference_month DESC LIMIT 1
      `),
    ]);
    const folhaEmpregadosMensal = Number(folhaRes[0]?.total ?? 0);
    const prolaboreMensal = Number(prolaboreRes[0]?.total ?? 0);
    const apurado = apuradoRes[0] ? Number(apuradoRes[0].rba12) : null;
    const usaApurado = apurado !== null && Number.isFinite(apurado) && apurado > 0;
    return {
      rbt12: usaApurado ? apurado! : Number(rbtRes[0]?.total ?? 0),
      rbt12Fonte: usaApurado ? 'APURADO' : 'HUB',
      folha12: (folhaEmpregadosMensal + prolaboreMensal) * 12,
      folhaEmpregados12: folhaEmpregadosMensal * 12,
      prolabore12: prolaboreMensal * 12,
    };
  });
}

/**
 * Salário mínimo nacional vigente (setting_code='MINIMUM_WAGE' em
 * tax_regime_setting, seedado por packages/db/src/seed-tax-rules.ts).
 * Fallback pro valor de 2026 (R$ 1.621,00, Decreto 12.797/2025) se o seed
 * ainda não rodou nesse ambiente — nunca deve ficar preso num valor de anos
 * anteriores como acontecia antes (constante de 2024 hardcoded no serviço).
 */
export async function getCurrentMinimumWage(): Promise<number> {
  const rows = await getDb().execute(sql`
    SELECT parameters
    FROM tax_regime_setting
    WHERE setting_code = 'MINIMUM_WAGE' AND valid_from <= now()::date
    ORDER BY valid_from DESC
    LIMIT 1
  `);
  const value = (rows[0]?.parameters as { value?: number } | undefined)?.value;
  return typeof value === 'number' && value > 0 ? value : 1621.0;
}

/**
 * Alíquota efetiva estimada pra uma NFSe deste tenant — mesma regra usada
 * em nfse/actions.ts na emissão, extraída aqui pra também alimentar o
 * preview de imposto no formulário (antes de emitir). Se optanteSimples,
 * usa a faixa do Simples pelo RBT12/Fator R; senão, a alíquota cadastrada
 * (do perfil de serviço, se houver, senão a global do cadastro fiscal).
 */
export async function estimateInvoiceTaxRate(
  ctx: TenantContext,
  cfg: NfseConfig,
  profileAliquota?: number | null,
): Promise<number> {
  if (cfg.optanteSimples) {
    /**
     * A alíquota REAL da última apuração manda.
     *
     * `tax_history` é alimentado pela volta do OneFlow com o que ele de fato
     * apurou — RBT12, alíquota efetiva e anexo. Preferi-la ao cálculo interno
     * é o que impede o descasamento entre o "imposto aproximado" que o
     * cliente vê ao emitir e o DAS que chega depois: quem calcula imposto é
     * o sistema contábil, e o Hub mostra o que ele calculou.
     */
    const real = await ultimaAliquotaApurada(ctx);
    if (real !== null) return real;

    const { rbt12, folha12 } = await getSimplesInputs(ctx);
    const { TaxThermometerService } = await import('@hexxa/core');
    const simples = new TaxThermometerService().simplesPosition({ rbt12, payroll12: folha12 });
    /**
     * EFETIVA, não nominal.
     *
     * O DAS é calculado sobre a alíquota efetiva, que desconta a parcela a
     * deduzir da faixa. Usar a nominal só coincide na primeira faixa (onde a
     * parcela é zero) e superestima daí para cima: numa empresa com RBT12 de
     * R$ 500 mil no Anexo III, a nominal é 13,5% e a efetiva 9,97% — o
     * cliente veria um imposto 35% maior que o real em toda nota emitida.
     */
    return simples.effectiveRate;
  }
  return profileAliquota ?? cfg.aliquotaIss ?? 0;
}

/**
 * Alíquota efetiva da apuração mais recente que o OneFlow devolveu.
 *
 * `null` quando ainda não há apuração importada — empresa nova, ou mês que
 * o contábil ainda não fechou. Aí o cálculo interno assume, e é por isso que
 * ele continua existindo.
 *
 * O filtro por `source` não é detalhe. A tabela também guarda estimativas
 * internas, calculadas pela alíquota NOMINAL da faixa, e sem o filtro a linha
 * mais recente podia ser uma delas — lida aqui como se fosse apuração real.
 * Era o que acontecia enquanto o cron de fechamento antigo escrevia ali: a
 * correção que fez o imposto aproximado vir do OneFlow era desfeita todo dia 1.
 */
async function ultimaAliquotaApurada(ctx: TenantContext): Promise<number | null> {
  const linhas = await withTenant(ctx.companyId, async (tx) =>
    tx.execute(sql`
      SELECT effective_rate FROM tax_history
       WHERE company_id = ${ctx.companyId}
         AND source = 'ONEFLOW'
       ORDER BY reference_month DESC
       LIMIT 1
    `),
  );
  if (linhas.length === 0) return null;
  const r = Number(linhas[0]!.effective_rate);
  return Number.isFinite(r) && r > 0 ? r : null;
}

/**
 * Pró-labore mensal mínimo (somado entre os sócios) para manter o Fator R
 * favorável (≥ 28%, Anexo III) dado o faturamento atual — usado pela
 * calculadora de pró-labore saudável em Sócios. Não conta o pró-labore já
 * lançado (é o valor NECESSÁRIO, não o atual).
 */
export function proLaboreMinimoParaFatorR(rbt12: number, folhaEmpregados12: number): number {
  const alvo = 0.28 * rbt12 - folhaEmpregados12;
  return Math.max(0, alvo / 12);
}

/**
 * Enquadramento oficial no Simples — o que o contábil APUROU, quando há.
 *
 * ── Por que as telas precisam disto ─────────────────────────────────────
 *
 * O cálculo interno decide Anexo III ou V pelo Fator R da folha, para toda
 * empresa. Mas o Fator R só vale para algumas atividades; outras estão no
 * Anexo III (ou I, II, IV) por natureza. Para essas, a tela dizia "Abaixo de
 * 28% · Anexo V" e o piloto automático recomendava aumentar o pró-labore —
 * mais INSS, sem benefício nenhum. É conselho errado com cara de cálculo.
 *
 * A apuração do OneFlow sabe o anexo, e o OneFlow calcula o Fator R oficial.
 * Nenhum endpoint diz se a atividade se sujeita ao Fator R — mas os dois
 * números juntos às vezes dizem. Onde há apuração, é o que as telas mostram;
 * o cálculo interno fica para quem ainda não tem, marcado como estimativa.
 *
 * `fatorRAplica`:
 * - `false` quando o anexo apurado é III com Fator R abaixo de 28% (seria V
 *   se a atividade se sujeitasse), ou quando o
 *   anexo apurado é I, II ou IV (o Fator R só escolhe entre III e V);
 * - `true` quando o anexo apurado é V (só se chega a ele pelo Fator R);
 * - `null` quando não se sabe.
 */
export interface EnquadramentoApurado {
  anexo: string;
  aliquotaEfetiva: number;
  mes: string;
  /** Fator R oficial (0.46 = 46%), quando o OneFlow calculou. */
  fatorR: number | null;
  fatorRAplica: boolean | null;
}

export async function enquadramentoApurado(ctx: TenantContext): Promise<EnquadramentoApurado | null> {
  const linhas = await withTenant(ctx.companyId, async (tx) =>
    tx.execute(sql`
      SELECT reference_month, effective_rate, tax_bracket, fator_r, fator_r_sujeito
        FROM tax_history
       WHERE company_id = ${ctx.companyId} AND source = 'ONEFLOW'
       ORDER BY reference_month DESC
       LIMIT 1
    `),
  );
  const l = linhas[0] as
    | {
        reference_month: string;
        effective_rate: string;
        tax_bracket: string;
        fator_r: string | null;
        fator_r_sujeito: boolean | null;
      }
    | undefined;
  if (!l) return null;

  const anexo = /Anexo\s+([IV]+)/i.exec(l.tax_bracket)?.[1]?.toUpperCase() ?? '';
  const foraPeloAnexo = ['I', 'II', 'IV'].includes(anexo);

  return {
    anexo,
    aliquotaEfetiva: Number(l.effective_rate),
    mes: l.reference_month,
    fatorR: l.fator_r === null ? null : Number(l.fator_r),
    fatorRAplica: foraPeloAnexo ? false : l.fator_r_sujeito,
  };
}

/**
 * Posição no Simples com o que é OFICIAL por cima do que é estimado.
 *
 * ── Por que existe ──────────────────────────────────────────────────────
 *
 * Cinco lugares calculavam a posição pela conta interna — `simplesPosition`
 * sobre RBT12 e folha — e usavam a alíquota dela para o VALOR do imposto:
 * a DRE, o balanço, a evolução mensal, o resumo do mês e o texto que a IA do
 * resumo lê. Era o mesmo descasamento que já tinha sido corrigido no imposto
 * aproximado da nota, ainda vivo em cinco telas: numa empresa apurada a 6%,
 * a conta interna podia dizer 15,5%.
 *
 * Onde há apuração importada do OneFlow, anexo, alíquota efetiva e Fator R
 * são os dela. Faixa, próxima faixa e alíquota nominal continuam vindo da
 * conta interna — são projeção, não fato, e a apuração não as devolve.
 */
export type PosicaoSimples = Omit<import('@hexxa/core').SimplesPosition, 'anexo'> & {
  /** 'I' a 'V'. A conta interna só conhece III e V; a apuração conhece todos. */
  anexo: string;
  fonte: 'APURADO' | 'ESTIMADO';
  /** Mês da apuração usada, 'AAAA-MM'. */
  mesApurado: string | null;
  /**
   * Faixa, alíquota nominal e projeção de próxima faixa estão na tabela
   * certa? Falso para os anexos I, II e IV, cujas tabelas o Hub não tem —
   * aí a tela esconde a projeção em vez de mostrar a do anexo errado.
   */
  projecaoConfiavel: boolean;
};

export async function posicaoSimples(
  ctx: TenantContext,
  entradas: { rbt12: number; folha12: number },
): Promise<PosicaoSimples> {
  const { TaxThermometerService } = await import('@hexxa/core');
  const calc = new TaxThermometerService().simplesPosition({
    rbt12: entradas.rbt12,
    payroll12: entradas.folha12,
  });
  const apurado = await enquadramentoApurado(ctx);
  if (!apurado || !apurado.anexo) {
    return { ...calc, fonte: 'ESTIMADO', mesApurado: null, projecaoConfiavel: true };
  }

  // Faixa e projeção na tabela do anexo APURADO. Deduzir pelo Fator R dava
  // Anexo V, com as alíquotas do V, para quem o contábil apurou no III.
  const tabelaConhecida = apurado.anexo === 'III' || apurado.anexo === 'V';
  const naTabela = tabelaConhecida
    ? new TaxThermometerService().simplesPosition({
        rbt12: entradas.rbt12,
        payroll12: entradas.folha12,
        anexo: apurado.anexo as 'III' | 'V',
      })
    : calc;

  return {
    ...naTabela,
    projecaoConfiavel: tabelaConhecida,
    anexo: apurado.anexo,
    effectiveRate: apurado.aliquotaEfetiva,
    fatorR: apurado.fatorR ?? calc.fatorR,
    // Com anexo apurado III ou V, "favorável" é o anexo — não a conta.
    fatorRFavorable: ['III', 'V'].includes(apurado.anexo) ? apurado.anexo === 'III' : calc.fatorRFavorable,
    fonte: 'APURADO',
    mesApurado: apurado.mes,
  };
}

/**
 * O Fator R decide o imposto desta empresa hoje?
 *
 * Uma regra só, usada pelo termômetro e pela tela de sócios — as duas
 * recomendavam pró-labore pelo Fator R para qualquer empresa, inclusive as
 * que estão no Anexo III pela própria atividade. Para essas, a recomendação
 * é aumentar o INSS sem ganho nenhum.
 *
 * - `fora: 'OFICIAL'` — deduzido de números oficiais: anexo apurado I, II ou
 *   IV; ou Anexo III com Fator R oficial abaixo de 28% (seria V se a
 *   atividade dependesse dele).
 * - `fora: 'ESTIMADO'` — Anexo III apurado, e só a estimativa do Hub dá
 *   abaixo de 28%. Conclusão mais fraca; quem mostra deve ser cauteloso. A
 *   recomendação some assim mesmo: esconder por engano tira uma sugestão,
 *   mostrar por engano aconselha a pagar INSS à toa.
 * - `fora: null` — se aplica, ou não há apuração para dizer o contrário.
 */
export function fatorRSeAplica(
  apurado: EnquadramentoApurado | null,
  fatorREstimado: number,
): { aplica: boolean; fora: 'OFICIAL' | 'ESTIMADO' | null } {
  if (apurado?.fatorRAplica === false) return { aplica: false, fora: 'OFICIAL' };
  if (
    apurado?.anexo === 'III' &&
    apurado.fatorRAplica !== true &&
    (apurado.fatorR ?? fatorREstimado) < 0.28
  ) {
    return { aplica: false, fora: apurado.fatorR !== null ? 'OFICIAL' : 'ESTIMADO' };
  }
  return { aplica: true, fora: null };
}
