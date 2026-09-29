import 'server-only';
import { revalidatePath } from 'next/cache';
import { getDb, sql, parceiroPeloDocumento } from '@hexxa/db';
import { ibsCbsDaNota, type TenantContext } from '@hexxa/core';
import { makeServiceInvoiceService, nfseMode } from './container';
import { getNfseConfig, estimateInvoiceTaxRate, listServiceProfiles } from './fiscal';
import { sendNfseEmailToCustomer } from './nfse-email';
import { acessoDoPlano, notasEmitidasNoMes } from './plano';
import { consultarCnpj, documentoValido, enderecoEmTexto, type EnderecoDaNota } from './cnpj';

/**
 * EMISSÃO DE NOTA — um caminho só, para o formulário, o um clique, a nota
 * agendada e a do contrato.
 *
 * O que ele faz antes de falar com o governo, nesta ordem:
 *
 * 1. Cliente: pelo id ou pelos dados digitados. CNPJ sem endereço é
 *    completado pela consulta pública e salvo no cadastro.
 * 2. Travas: documento válido, perfil fiscal, valor, descrição; e as duas de
 *    duplicidade — clique duplo (bloqueia) e nota igual no mesmo mês
 *    (pergunta, a não ser que já tenham confirmado).
 * 3. Imposto estimado pela mesma régua da Bússola.
 * 4. Emite, manda o e-mail e traduz o erro do Emissor Nacional para o que
 *    fazer.
 */

export interface PedidoDeEmissao {
  customerId?: string;
  cliente?: { nome: string; documento: string; email?: string; endereco?: EnderecoDaNota };
  valor: number;
  descricao: string;
  perfilId?: string;
  /** Data de competência 'AAAA-MM-DD' (padrão: hoje). */
  competencia?: string;
  vencimento?: string;
  reterIss?: boolean;
  contractId?: string;
  /** Já viu o aviso de nota igual no mês e quer emitir mesmo assim. */
  confirmarDuplicada?: boolean;
  enviarEmail?: boolean;
  /** Para quem mandar a nota por e-mail (sem lista: o e-mail do cliente). */
  emails?: string[];
  /** Informações complementares (pedido, dados de pagamento…) — campo próprio da nota. */
  informacoes?: string;
  /** WhatsApp para onde a pessoa vai mandar a nota — volta um link pronto. */
  whatsapp?: string;
  /**
   * A parcela de contrato que esta nota fatura. A nota ASSUME a parcela (vira
   * o recebível dela) em vez de criar outro — sem isso a receita apareceria
   * duas vezes no Financeiro.
   */
  parcelaId?: string;
  /** De onde a nota saiu — aparece na visualização rápida em Notas. */
  origem?: OrigemDaEmissao;
}

export type OrigemDaEmissao = 'MANUAL' | 'UM_CLIQUE' | 'AGENDADA' | 'CONTRATO';

export interface ResultadoDaEmissao {
  ok: boolean;
  message: string;
  status?: 'ISSUED' | 'ISSUING' | 'ERROR';
  /** Precisa de um "sim" antes de emitir. */
  precisaConfirmar?: 'DUPLICADA';
  nfseNumber?: string;
  taxAmount?: number;
  taxRate?: number;
  netAmount?: number;
  invoiceId?: string;
  providerProtocol?: string;
  /** Link do WhatsApp com a mensagem da nota, pronto para enviar. */
  whatsappLink?: string;
}

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

/**
 * O Emissor Nacional abre a emissão por sistema para o Simples Nacional em
 * 1º/11/2026. Antes disso, a nota do Simples é emitida no próprio Emissor e
 * volta para a Hexx pela sincronização — mas já dá para AGENDAR a partir daí.
 */
export const LIBERA_SIMPLES = '2026-11-01';

export async function emitirNota(ctx: TenantContext, p: PedidoDeEmissao): Promise<ResultadoDaEmissao> {
  const db = getDb();

  const [reg] = (await db.execute(sql`SELECT tax_regime FROM company WHERE id = ${ctx.companyId}`)) as unknown as { tax_regime: string | null }[];
  if (reg?.tax_regime === 'SIMPLES_NACIONAL' && hojeSP() < LIBERA_SIMPLES) {
    return { ok: false, message: 'Para o Simples Nacional, a emissão pela Hexx libera em 1º de novembro. Até lá, emita no Emissor Nacional — ou agende para novembro.' };
  }

  // ── Limite de notas do plano (Simples Light: 10 por mês) ───────────────────
  // O contador pode liberar um mês na ficha do cliente (company.notas_extras_mes).
  const acesso = await acessoDoPlano(ctx.companyId);
  const mesAtual = hojeSP().slice(0, 7);
  let avisoDoLimite = '';
  if (acesso.limiteNotasMes && acesso.notasLiberadasNoMes !== mesAtual) {
    const emitidas = await notasEmitidasNoMes(ctx.companyId, mesAtual);
    if (emitidas >= acesso.limiteNotasMes) {
      return {
        ok: false,
        message:
          `O plano ${acesso.plano ?? 'atual'} inclui ${acesso.limiteNotasMes} notas por mês, e as deste mês já foram usadas. ` +
          'Para emitir mais, mude para o plano Simples (notas sem limite) ou peça ao escritório a liberação deste mês.',
      };
    }
    if (emitidas + 1 === acesso.limiteNotasMes) avisoDoLimite = ` Esta é a última nota do seu plano neste mês (${acesso.limiteNotasMes} de ${acesso.limiteNotasMes}).`;
    else if (emitidas + 1 === acesso.limiteNotasMes - 1) avisoDoLimite = ` Resta 1 nota no seu plano neste mês.`;
  }

  // ── 1. Cliente ────────────────────────────────────────────────────────────
  let cliente = p.cliente;
  if (p.customerId) {
    const [c] = (await db.execute(sql`
      SELECT name, document, email, endereco FROM customer WHERE id = ${p.customerId} AND company_id = ${ctx.companyId}
    `)) as unknown as { name: string; document: string | null; email: string | null; endereco: EnderecoDaNota | null }[];
    if (!c) return { ok: false, message: 'Cliente não encontrado.' };
    cliente = { nome: c.name, documento: c.document ?? '', email: c.email ?? undefined, endereco: c.endereco ?? undefined };
  }
  if (!cliente?.nome?.trim()) return { ok: false, message: 'Informe o cliente.' };
  const documento = cliente.documento.replace(/\D/g, '');
  if (!documentoValido(documento)) return { ok: false, message: `O ${documento.length > 11 ? 'CNPJ' : 'CPF'} do cliente não é válido — confira os números.` };

  // CNPJ sem endereço: a consulta pública completa (e o cadastro guarda).
  let endereco = cliente.endereco;
  if (!endereco && documento.length === 14) {
    const dados = await consultarCnpj(documento);
    if (dados?.endereco) endereco = dados.endereco;
  }

  // ── 2. Travas ─────────────────────────────────────────────────────────────
  if (!Number.isFinite(p.valor) || p.valor <= 0) return { ok: false, message: 'Informe um valor maior que zero.' };
  if (!p.descricao?.trim()) return { ok: false, message: 'Descreva o serviço prestado.' };

  const [cfg, perfis] = await Promise.all([getNfseConfig(ctx), listServiceProfiles(ctx)]);
  if (!cfg) return { ok: false, message: 'O cadastro fiscal da empresa está incompleto — complete em Configurações > Fiscal.' };
  const perfil = perfis.find((x) => x.id === p.perfilId) ?? (perfis.length === 1 ? perfis[0] : undefined);
  if (!perfil) {
    return { ok: false, message: perfis.length ? 'Escolha o perfil fiscal do serviço.' : 'Cadastre um perfil fiscal de serviço nas configurações.' };
  }

  const competencia = p.competencia || hojeSP();
  const mes = competencia.slice(0, 7);

  // Clique duplo: a mesma nota há menos de 2 minutos não sai de novo, nem com confirmação.
  const [recente] = (await db.execute(sql`
    SELECT si.id FROM service_invoice si JOIN customer c ON c.id = si.customer_id
     WHERE si.company_id = ${ctx.companyId} AND regexp_replace(coalesce(c.document, ''), '[^0-9]', '', 'g') = ${documento}
       AND si.amount = ${p.valor.toFixed(2)} AND si.status IN ('ISSUED', 'ISSUING')
       AND si.created_at > now() - interval '2 minutes'
     LIMIT 1
  `)) as unknown as { id: string }[];
  if (recente) return { ok: false, message: 'Esta nota acabou de ser emitida — não foi enviada de novo.' };

  // Nota igual no mesmo mês: pergunta antes.
  if (!p.confirmarDuplicada) {
    const [igual] = (await db.execute(sql`
      SELECT si.nfse_number FROM service_invoice si JOIN customer c ON c.id = si.customer_id
       WHERE si.company_id = ${ctx.companyId} AND regexp_replace(coalesce(c.document, ''), '[^0-9]', '', 'g') = ${documento}
         AND si.amount = ${p.valor.toFixed(2)} AND si.status IN ('ISSUED', 'ISSUING')
         AND to_char(si.reference_month, 'YYYY-MM') = ${mes}
       LIMIT 1
    `)) as unknown as { nfse_number: string | null }[];
    if (igual) {
      return {
        ok: false,
        precisaConfirmar: 'DUPLICADA',
        message: `Já existe uma nota${igual.nfse_number ? ` (nº ${igual.nfse_number})` : ''} para ${cliente.nome} com este valor neste mês. Emitir outra?`,
      };
    }
  }

  // ── 3. Imposto estimado ───────────────────────────────────────────────────
  const taxRate = await estimateInvoiceTaxRate(ctx, cfg, perfil.aliquotaIss);
  const taxAmount = (p.valor * taxRate) / 100;

  // ── 4. Emitir ─────────────────────────────────────────────────────────────
  const service = await makeServiceInvoiceService(ctx);
  const result = await service.emit(ctx, {
    customer: { name: cliente.nome, document: documento, email: cliente.email, ...(endereco ? { address: endereco } : {}) } as never,
    amount: p.valor,
    serviceDescription: p.descricao.trim(),
    referenceMonth: mes,
    competenciaDate: competencia,
    dueDate: p.vencimento,
    retainIss: p.reterIss,
    contractId: p.contractId,
    estimatedTaxAmount: taxAmount,
    estimatedTaxRate: taxRate,
    serviceOverride: {
      itemListaServico: perfil.itemListaServico,
      codigoTributacaoMunicipio: perfil.codigoTributacaoMunicipio ?? undefined,
      aliquotaIss: perfil.aliquotaIss ?? undefined,
      cnae: perfil.cnae ?? undefined,
    },
    nfseServiceProfileId: perfil.id,
    informacoesComplementares: p.informacoes?.trim() || undefined,
    // Reforma: NBS, operação e classificação pela tabela oficial (Anexo VIII),
    // com o que o perfil sobrepuser. Só vai ao XML se o leiaute estiver ligado.
    ibsCbs: ibsCbsDaNota({ itemLc116: perfil.itemListaServico, nbs: perfil.cNbs, cClassTrib: perfil.cClassTrib, cst: perfil.cstIbsCbs }) ?? undefined,
  });

  if (result.invoiceId) {
    await db
      .execute(sql`UPDATE service_invoice SET origem = ${p.origem ?? 'MANUAL'} WHERE id = ${result.invoiceId}::uuid AND company_id = ${ctx.companyId}`)
      .catch(() => {});
  }

  // O cadastro do cliente guarda o endereço completo para as próximas notas.
  if (endereco) {
    await db
      .execute(sql`
        UPDATE customer SET endereco = ${JSON.stringify(endereco)}::jsonb, address = coalesce(address, ${enderecoEmTexto(endereco)})
         WHERE company_id = ${ctx.companyId} AND regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g') = ${documento} AND endereco IS NULL
      `)
      .catch(() => {});
  }

  // O tomador vira o parceiro do recebível da nota — é por ele que o Pix do
  // extrato baixa a nota certa e que o OneFlow aceita a conta de Clientes.
  if (result.status !== 'ERROR') {
    const parceiro = await parceiroPeloDocumento(db, ctx.companyId, { nome: cliente.nome, documento, tipo: 'CLIENT' }).catch(() => null);
    if (parceiro) {
      await db
        .execute(sql`
          UPDATE financial_entry SET partner_id = ${parceiro}::uuid
           WHERE company_id = ${ctx.companyId} AND source = 'NFSE' AND source_id = ${result.invoiceId}::uuid AND partner_id IS NULL
        `)
        .catch((e) => console.error('[emissao] parceiro', e));
    }
  }

  revalidatePath('/meu-negocio/notas');
  revalidatePath('/cliente');

  if (result.status === 'ERROR') {
    return { ok: false, status: 'ERROR', invoiceId: result.invoiceId, message: explicarErro(result.errorMessage) };
  }

  const base = { taxAmount, taxRate, netAmount: p.valor - taxAmount, invoiceId: result.invoiceId, providerProtocol: result.providerProtocol };
  if (result.status === 'ISSUING') {
    return { ok: true, status: 'ISSUING', ...base, message: 'Nota enviada ao Emissor Nacional, aguardando a autorização. O status atualiza sozinho.' };
  }

  // A nota assume a parcela do contrato: o recebível que a emissão acabou de
  // criar sai, e a parcela (com o que já foi pago dela) passa a ser da nota.
  if (p.parcelaId) {
    await db
      .execute(sql`
        WITH parcela AS (
          UPDATE financial_entry SET source = 'NFSE', source_id = ${result.invoiceId}::uuid
           WHERE id = ${p.parcelaId}::uuid AND company_id = ${ctx.companyId} AND source = 'CONTRACT' AND type = 'RECEIVABLE'
          RETURNING id
        )
        DELETE FROM financial_entry
         WHERE company_id = ${ctx.companyId} AND source = 'NFSE' AND source_id = ${result.invoiceId}::uuid
           AND type = 'RECEIVABLE' AND id NOT IN (SELECT id FROM parcela) AND EXISTS (SELECT 1 FROM parcela)
      `)
      .catch((e) => console.error('[emissao] parcela', e));
  }

  let emailSent = false;
  if (!result.isMock && p.enviarEmail !== false) {
    emailSent = await sendNfseEmailToCustomer(ctx, result.invoiceId, p.emails).then((r) => r.sent).catch(() => false);
  }
  const wa = (p.whatsapp ?? '').replace(/\D/g, '');
  const whatsappLink = wa.length >= 10
    ? `https://wa.me/${wa.length <= 11 ? `55${wa}` : wa}?text=${encodeURIComponent(
        `Olá! Segue a nota fiscal${result.nfseNumber ? ` nº ${result.nfseNumber}` : ''} de ${p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}, referente a: ${p.descricao.trim().slice(0, 140)}.` +
          (result.providerProtocol ? ` Consulte em nfse.gov.br (chave ${result.providerProtocol}).` : ''),
      )}`
    : undefined;
  return {
    ok: true,
    status: 'ISSUED',
    nfseNumber: result.nfseNumber,
    ...base,
    whatsappLink,
    message: result.isMock
      ? `[MODO TESTE] Nota${result.nfseNumber ? ` nº ${result.nfseNumber}` : ''} salva, mas NÃO foi enviada ao governo — configure o certificado A1 para emitir de verdade.`
      : `Nota${result.nfseNumber ? ` nº ${result.nfseNumber}` : ''} autorizada.${emailSent ? ' E-mail enviado ao cliente.' : ''}${avisoDoLimite}`,
  };
}

/**
 * O erro do Emissor Nacional traduzido para o que fazer. A mensagem original
 * vai junto — é ela que diagnostica o caso que a tradução não cobre.
 */
export function explicarErro(original?: string): string {
  const m = original ?? '';
  const dica = /certificad/i.test(m)
    ? 'O certificado digital foi recusado — confira se está válido em Configurações > Fiscal.'
    : /munic[ií]pio|cMun|IBGE/i.test(m)
      ? 'O município do cliente ou da empresa não foi aceito — confira o endereço do cliente.'
      : /CNPJ|CPF|inscri/i.test(m)
        ? 'O documento do cliente ou da empresa foi recusado — confira o CNPJ/CPF.'
        : /tribut|cTribNac|item da lista|LC ?116/i.test(m)
          ? 'O código do serviço foi recusado — confira o perfil fiscal (item da LC 116 e código de tributação).'
          : /al[ií]quota|ISS/i.test(m)
            ? 'A alíquota de ISS foi recusada — confira o perfil fiscal.'
            : /duplic|j[aá] existe|n[uú]mero/i.test(m)
              ? 'O Emissor Nacional diz que esta nota já existe — confira a lista antes de tentar de novo.'
              : 'O Emissor Nacional recusou a nota.';
  return m ? `${dica} (Emissor Nacional: ${m})` : dica;
}

/** Modo do emissor, para a tela avisar quando está em teste. */
export { nfseMode };
