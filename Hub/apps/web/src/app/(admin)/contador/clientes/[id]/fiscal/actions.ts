'use server';

import { saveNfseConfig } from '@/lib/server/fiscal';
import { inspecionarCertificado } from '@hexxa/integrations';
import { normalizeDocument } from '@hexxa/core/document-br';
import { syncDistribuicaoDfe } from '@/lib/server/nfse-dfe-sync';
import type { TenantContext } from '@hexxa/core';
import { sql } from '@hexxa/db';
import { taxHistory, getDb, eq, and, withDbTimeout } from '@hexxa/db';
import { lerExtratoPgdas } from '@hexxa/core';
import { integrationCredential } from '@hexxa/db/schema';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/server/admin-guard';

/**
 * Token do Oneflow é POR EMPRESA CLIENTE (a doc deles não expõe CNPJ nas
 * chamadas de fiscal/contábil — só funciona "no contexto do token"), e fica
 * só aqui na área do contador — o cliente não vê nem mexe nisso.
 *
 * STATUS: salva de verdade (provider='oneflow' em integration_credential),
 * mas hoje NENHUM código lê esse token de volta — órfão até a integração
 * real de puxar guia/dado do OneFlow (Omie) ser construída. Não confundir
 * com o provider='omie' usado por packages/core/src/services/omie-integration.service.ts
 * (também ainda placeholder, mas é o lado do TENANT, não do contador).
 * Quando for implementar a automação de guias do OneFlow, reaproveitar esta
 * estrutura em vez de criar uma terceira.
 */
export async function getOneflowCredential(companyId: string): Promise<{ hasToken: boolean; active: boolean }> {
  await requireAdmin();
  const db = getDb();
  const [row] = await withDbTimeout(
    db
      .select({ active: integrationCredential.active })
      .from(integrationCredential)
      .where(and(eq(integrationCredential.companyId, companyId), eq(integrationCredential.provider, 'oneflow'))),
    8000,
  );
  return { hasToken: !!row, active: row?.active ?? false };
}

export async function saveOneflowToken(companyId: string, token: string) {
  await requireAdmin();
  if (!token.trim()) throw new Error('Cole o token do Oneflow dessa empresa.');
  const db = getDb();
  const [existing] = await withDbTimeout(
    db
      .select({ id: integrationCredential.id })
      .from(integrationCredential)
      .where(and(eq(integrationCredential.companyId, companyId), eq(integrationCredential.provider, 'oneflow'))),
    8000,
  );

  if (existing) {
    await withDbTimeout(
      db
        .update(integrationCredential)
        .set({ secretRef: { token: token.trim() }, active: true })
        .where(eq(integrationCredential.id, existing.id)),
      8000,
    );
  } else {
    await withDbTimeout(
      db.insert(integrationCredential).values({
        companyId,
        kind: 'ERP',
        provider: 'oneflow',
        secretRef: { token: token.trim() },
        active: true,
      }),
      8000,
    );
  }

  revalidatePath(`/contador/clientes/${companyId}/fiscal`);
  return { success: true };
}

export async function disconnectOneflow(companyId: string) {
  await requireAdmin();
  const db = getDb();
  await withDbTimeout(
    db
      .update(integrationCredential)
      .set({ active: false })
      .where(and(eq(integrationCredential.companyId, companyId), eq(integrationCredential.provider, 'oneflow'))),
    8000,
  );
  revalidatePath(`/contador/clientes/${companyId}/fiscal`);
  return { success: true };
}

export async function processPGDAS(companyId: string, formData: FormData) {
  await requireAdmin();
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('Nenhum arquivo enviado.');

    // require() só aqui dentro (nunca no topo do módulo): o pdf-parse
    // referencia DOMMatrix (global de browser) em algum ponto da cadeia de
    // import dele, e o build do Next avalia o módulo inteiro na hora de
    // "collect page data" — um require de topo derruba o build inteiro.
    const pdfParse = require('pdf-parse');

    // Ler o arquivo PDF
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const pdfData = await pdfParse(buffer);

    /**
     * A leitura mora em `lerExtratoPgdas`, testada, e não mais aqui.
     *
     * Estava inline, com as regex no meio da gravação no banco e sem teste
     * nenhum — um parser de documento fiscal sem teste funciona no PDF de
     * quem o escreveu e ninguém sabe o que faz no próximo. A mesma função
     * atende o cliente no primeiro acesso.
     */
    const leitura = lerExtratoPgdas(pdfData.text);
    if (!leitura.ok || !leitura.extrato) {
      return { success: false, error: leitura.motivo ?? 'Não consegui ler o extrato.' };
    }
    const rba12 = leitura.extrato.rbt12;
    const aliquota = leitura.extrato.aliquotaEfetiva ?? 0;
    const anexo = leitura.extrato.anexo ?? 'Anexo III';
    const referenceMonth = leitura.extrato.competencia ?? new Date().toISOString().slice(0, 7);

    // Insert into database
    const db = getDb();
    await withDbTimeout(
      db.insert(taxHistory).values({
        companyId,
        referenceMonth,
        rba12: rba12.toString(),
        effectiveRate: aliquota.toString(),
        taxBracket: anexo,
      }).onConflictDoUpdate({
        target: [taxHistory.companyId, taxHistory.referenceMonth],
        set: {
          rba12: rba12.toString(),
          effectiveRate: aliquota.toString(),
          taxBracket: anexo,
        }
      }),
      8000,
    );

    revalidatePath(`/contador/clientes/${companyId}/fiscal`);
    revalidatePath('/minha-contabilidade/termometro-tributario');
    return { success: true, rba12, aliquota, anexo, referenceMonth };
  } catch (err: any) {
    console.error('Error processing PGDAS:', err);
    return { success: false, error: err.message || 'Erro ao processar PDF' };
  }
}

// ── Enquadramento no Simples (anexo e Fator R) ─────────────────────────────

/** O contador marca o anexo e a sujeição ao Fator R — vale até haver apuração do OneFlow. */
export async function salvarEnquadramentoAction(
  companyId: string,
  anexo: 'III' | 'IV' | 'V' | '',
  fatorR: 'SUJEITO' | 'NAO_SUJEITO' | '',
): Promise<{ ok: boolean; mensagem: string }> {
  await requireAdmin();
  const { sql } = await import('@hexxa/db');
  // Anexo IV nunca depende do Fator R; o V só existe por causa dele.
  const fr = anexo === 'IV' ? 'NAO_SUJEITO' : anexo === 'V' ? 'SUJEITO' : fatorR || null;
  await getDb().execute(sql`
    UPDATE company SET simples_anexo = ${anexo || null}, simples_fator_r = ${fr} WHERE id = ${companyId}
  `);
  revalidatePath(`/contador/clientes/${companyId}/fiscal`);
  return { ok: true, mensagem: anexo ? 'Enquadramento salvo. A Bússola do cliente passa a usar este anexo.' : 'Marcação removida.' };
}

export async function sugerirEnquadramentoAction(companyId: string) {
  await requireAdmin();
  const { sugerirEnquadramento } = await import('@/lib/server/enquadramento');
  return sugerirEnquadramento(companyId);
}

// ── Certificado digital pelo escritório ────────────────────────────────────

export type EstadoDoCertificado = { ok: boolean; message: string };

/**
 * O contador envia (ou troca) o certificado A1 do cliente pela área dele —
 * sem depender do cliente entrar no Hub. Confere senha, validade e CNPJ,
 * grava criptografado (saveNfseConfig) em PRODUÇÃO e já busca as notas
 * emitidas e recebidas no Emissor Nacional: é o que faz a receita (da nota)
 * e os fornecedores com CNPJ entrarem no Hub e seguirem para o OneFlow.
 */
export async function enviarCertificadoDoClienteAction(
  companyId: string,
  _prev: EstadoDoCertificado,
  formData: FormData,
): Promise<EstadoDoCertificado> {
  await requireAdmin();
  const arquivo = formData.get('pfx');
  const senha = String(formData.get('senha') ?? '').trim();
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, message: 'Escolha o arquivo .pfx do certificado.' };
  if (!/\.(pfx|p12)$/i.test(arquivo.name)) return { ok: false, message: 'O certificado é um arquivo .pfx ou .p12.' };
  if (arquivo.size > 1024 * 1024) return { ok: false, message: 'Arquivo grande demais para um certificado.' };
  if (!senha) return { ok: false, message: 'Informe a senha do certificado.' };

  const [empresa] = (await getDb().execute(
    sql`SELECT cnpj, type, legal_name, tax_regime FROM company WHERE id = ${companyId}`,
  )) as unknown as { cnpj: string | null; type: string; legal_name: string; tax_regime: string | null }[];
  if (!empresa) return { ok: false, message: 'Empresa não encontrada.' };
  const ctx = { companyId, companyType: empresa.type, userId: 'contador' } as TenantContext;

  const b64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');
  let ficha;
  try {
    ficha = inspecionarCertificado(b64, senha);
  } catch {
    return { ok: false, message: 'Não consegui abrir o certificado. Confira a senha.' };
  }
  const cnpjDaEmpresa = normalizeDocument(empresa.cnpj ?? '');
  if (ficha.cnpj && cnpjDaEmpresa && ficha.cnpj !== cnpjDaEmpresa) {
    return { ok: false, message: `Este certificado é de outro CNPJ (${ficha.cnpj}), não de ${empresa.legal_name}.` };
  }
  if (ficha.vencido) return { ok: false, message: `Este certificado venceu em ${ficha.validoAte}.` };

  await saveNfseConfig(ctx, {
    certPfxB64: b64,
    certPassword: senha,
    cnpj: cnpjDaEmpresa || ficha.cnpj || undefined,
    razaoSocial: empresa.legal_name,
    ambiente: 'producao',
    optanteSimples: empresa.tax_regime === 'SIMPLES_NACIONAL',
  } as never);

  // Já traz as notas do Emissor Nacional (emitidas e recebidas).
  const sync = await syncDistribuicaoDfe(ctx).catch((e: unknown) => ({ erro: e instanceof Error ? e.message : String(e) }) as never);
  revalidatePath(`/contador/clientes/${companyId}/fiscal`);
  const r = sync as { erro?: string; documentosNovos?: number };
  return {
    ok: true,
    message: r.erro
      ? `Certificado salvo (válido até ${ficha.validoAte}). A busca das notas falhou agora: ${r.erro} — ela roda de novo toda madrugada.`
      : `Certificado salvo (válido até ${ficha.validoAte}). ${r.documentosNovos ?? 0} documento(s) trazido(s) do Emissor Nacional.`,
  };
}
