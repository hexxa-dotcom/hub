import 'server-only';
import { createHash, randomInt } from 'node:crypto';
import QRCode from 'qrcode';
import { origemPublica } from '@/lib/server/origem';
import { renderToBuffer } from '@react-pdf/renderer';
import type { TenantContext } from '@hexxa/core';
import { getDb, withTenant, withDbTimeout, eq, and, sql } from '@hexxa/db';
import { company, membership, appUser, businessContract, contractSignature, notification } from '@hexxa/db/schema';
import { normalizeDocument, formatDocument } from '@hexxa/core/document-br';
import { makeContractSignatureService } from '@/lib/server/container';
import { gerarLancamentosDoContrato, jaTemLancamentosDoContrato } from '@/lib/server/contract-financials';
import { ContratoPdf, AREAS_DE_ASSINATURA } from '@/app/(portal)/meu-negocio/contratos/ContratoPdf';
import { MODELOS, type ModeloDeContrato, type IndiceDeReajuste } from '@/app/(portal)/meu-negocio/contratos/modelos';

/**
 * CONTRATOS — criar, assinar dos dois lados, ativar e reajustar.
 *
 * O caminho de um contrato:
 *
 *   1. criado (a partir de um modelo, ou de um PDF próprio);
 *   2. assinado pelas DUAS partes —
 *        HUB      quando a outra parte também usa a Hexx: cada uma assina
 *                 dentro do sistema; o contrato aparece para a outra como
 *                 "aguardando sua assinatura", com aviso;
 *        DOCUSEAL quando a outra parte está fora: um envelope com os dois
 *                 signatários; a empresa assina embutido, a outra por e-mail;
 *        FORA     quando o PDF já veio assinado;
 *   3. ativo: as parcelas entram no financeiro de cada lado (e, com isso, no
 *      calendário), só depois das duas assinaturas;
 *   4. a cada aniversário, o reajuste pelo índice — que muda também as
 *      parcelas ainda não pagas.
 */

export type TipoDeContrato = 'ENTRADA' | 'SAIDA';
const ESPELHO: Record<string, string> = { ENTRADA: 'SAIDA', SAIDA: 'ENTRADA', MUTUO_ATIVO: 'MUTUO_PASSIVO', MUTUO_PASSIVO: 'MUTUO_ATIVO' };

export interface NovoContrato {
  modelo: ModeloDeContrato | 'PROPRIO';
  /** Só para PROPRIO: nos modelos o tipo vem do próprio modelo. */
  tipo?: TipoDeContrato;
  categoria?: string;
  parte: { nome: string; documento: string; endereco: string; email: string };
  titulo?: string;
  objeto: string;
  valor: number;
  diaVencimento: number;
  formaPagamento: string;
  inicio: string;
  fim: string;
  indice: IndiceDeReajuste;
  emitirNota?: boolean;
  /** PDF próprio (modelo PROPRIO). */
  pdf?: { base64: string; nome: string };
  /** O PDF próprio já veio assinado: registra e ativa na hora. */
  jaAssinadoEm?: string;
}

export interface ResultadoDaCriacao {
  ok: boolean;
  message: string;
  id?: string;
  assinatura?: 'HUB' | 'DOCUSEAL' | 'FORA';
  /** DOCUSEAL: link para a empresa assinar ali mesmo. */
  linkParaAssinar?: string | null;
}

const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const umAnoDepois = (iso: string) => {
  const [a, m, d] = iso.split('-');
  return `${Number(a) + 1}-${m}-${d}`;
};
const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string) => iso.split('-').reverse().join('/');

function enderecoDa(c: { addressLine1: string | null; addressNumber: string | null; neighborhood: string | null; city: string | null; state: string | null }) {
  return [
    c.addressLine1 ? `${c.addressLine1}, ${c.addressNumber || 's/n'}` : null,
    c.neighborhood,
    c.city && c.state ? `${c.city}/${c.state}` : c.city,
  ]
    .filter(Boolean)
    .join(' — ');
}

/** Quem assina pela empresa: o usuário logado; sem login, o dono da empresa. */
export async function quemAssina(ctx: TenantContext): Promise<{ userId: string | null; nome: string; email: string; cpf: string | null } | null> {
  const db = getDb();
  if (ctx.userId && /^[0-9a-f-]{36}$/i.test(ctx.userId)) {
    const [u] = await db.select().from(appUser).where(eq(appUser.id, ctx.userId)).limit(1);
    if (u) return { userId: u.id, nome: u.name, email: u.email, cpf: u.cpf };
  }
  const [m] = await db
    .select({ id: appUser.id, name: appUser.name, email: appUser.email, cpf: appUser.cpf })
    .from(membership)
    .innerJoin(appUser, eq(appUser.id, membership.userId))
    .where(eq(membership.companyId, ctx.companyId))
    .orderBy(sql`CASE WHEN ${membership.role} = 'OWNER' THEN 0 ELSE 1 END`, membership.createdAt)
    .limit(1);
  return m ? { userId: m.id, nome: m.name, email: m.email, cpf: m.cpf } : null;
}

/** A outra parte usa a Hexx? (pelo CNPJ) */
export async function empresaDoHubPeloCnpj(documento: string, exceto: string) {
  const digitos = normalizeDocument(documento);
  if (digitos.length !== 14) return null;
  const [c] = await withDbTimeout(
    getDb()
      .select({ id: company.id, legalName: company.legalName, tradeName: company.tradeName, email: company.email })
      .from(company)
      .where(eq(company.cnpj, formatDocument(digitos))),
    8000,
  );
  return c && c.id !== exceto ? c : null;
}

async function avisar(companyId: string, titulo: string, corpo: string, severity: 'INFO' | 'WARNING' = 'INFO') {
  try {
    await getDb().insert(notification).values({ companyId, title: titulo, body: corpo, severity });
  } catch (err) {
    console.error('[contratos] aviso não gravado:', err);
  }
}

export async function criarContrato(ctx: TenantContext, input: NovoContrato): Promise<ResultadoDaCriacao> {
  const db = getDb();
  const [minha] = await db.select().from(company).where(eq(company.id, ctx.companyId));
  if (!minha) return { ok: false, message: 'Empresa não encontrada.' };

  const tipo: TipoDeContrato = input.modelo === 'PROPRIO' ? (input.tipo ?? 'ENTRADA') : (MODELOS[input.modelo].tipo ?? input.tipo ?? 'ENTRADA');
  const parte = { ...input.parte, nome: input.parte.nome.trim(), email: input.parte.email.trim() };
  if (!parte.nome) return { ok: false, message: 'Informe com quem é o contrato.' };
  if (!(input.valor > 0)) return { ok: false, message: 'Informe o valor mensal.' };
  if (!input.inicio || !input.fim || input.fim < input.inicio) return { ok: false, message: 'Confira as datas de início e fim.' };
  if (input.diaVencimento < 1 || input.diaVencimento > 31) return { ok: false, message: 'O dia de vencimento vai de 1 a 31.' };
  if (input.modelo === 'PROPRIO' && !input.pdf) return { ok: false, message: 'Anexe o PDF do contrato.' };

  const outra = await empresaDoHubPeloCnpj(parte.documento, ctx.companyId);
  const assinatura: 'HUB' | 'DOCUSEAL' | 'FORA' = input.jaAssinadoEm ? 'FORA' : outra ? 'HUB' : 'DOCUSEAL';
  if (assinatura === 'DOCUSEAL' && !parte.email) {
    return { ok: false, message: 'Informe o e-mail de quem assina pela outra parte — é para lá que vai o contrato.' };
  }
  const signatario = await quemAssina(ctx);
  if (assinatura === 'DOCUSEAL' && !signatario) return { ok: false, message: 'Não achei quem assina pela sua empresa.' };

  const eu = { nome: minha.legalName, documento: formatDocument(normalizeDocument(minha.cnpj)), endereco: enderecoDa(minha) };
  const ela = {
    nome: outra?.legalName ?? parte.nome,
    documento: normalizeDocument(parte.documento) ? formatDocument(normalizeDocument(parte.documento)) : '',
    endereco: parte.endereco,
  };
  const souContratada = tipo === 'ENTRADA';
  // O título é o serviço em poucas palavras ("Gestão das redes sociais"); o
  // texto inteiro fica na descrição.
  const resumo = (t: string) => {
    const limpo = t.trim().replace(/\s+/g, ' ');
    const curto = limpo.length <= 60 ? limpo : `${limpo.slice(0, 60).replace(/\s+\S*$/, '')}…`;
    return curto.charAt(0).toUpperCase() + curto.slice(1);
  };
  const titulo =
    input.titulo?.trim() ||
    (input.modelo === 'PJ' ? `Contratação PJ — ${ela.nome}` : input.objeto.trim() ? resumo(input.objeto) : MODELOS.CLIENTE.titulo);

  // O código de verificação vai impresso no PDF (e por isso entra no hash).
  const codigo = await novoCodigoDeVerificacao();
  const urlDeConferencia = `${await origemPublica()}/v/${codigo}`;

  // O documento: o do modelo, ou o PDF que a pessoa trouxe.
  let pdfBase64: string;
  if (input.modelo === 'PROPRIO') {
    pdfBase64 = input.pdf!.base64.replace(/^data:[^,]+,/, '');
  } else {
    const buffer = await renderToBuffer(
      <ContratoPdf
        dados={{
          modelo: input.modelo,
          categoria: input.categoria,
          contratante: souContratada ? ela : eu,
          contratada: souContratada ? eu : ela,
          objeto: input.objeto.trim(),
          valorMensal: brl(input.valor),
          diaVencimento: input.diaVencimento,
          formaPagamento: input.formaPagamento.trim() || 'Pix ou boleto bancário',
          inicio: dataBr(input.inicio),
          fim: dataBr(input.fim),
          indice: input.indice,
          cidadeData: `${minha.city ?? ''}${minha.state ? `/${minha.state}` : ''}, ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
        }}
        paginaDeAssinaturas={assinatura === 'DOCUSEAL'}
        verificacao={{
          codigo,
          url: urlDeConferencia.replace(/^https?:\/\//, ''),
          qr: await QRCode.toDataURL(urlDeConferencia, { margin: 0, width: 240, errorCorrectionLevel: 'M' }),
        }}
      />,
    );
    pdfBase64 = buffer.toString('base64');
  }
  const hash = createHash('sha256').update(Buffer.from(pdfBase64, 'base64')).digest('hex');

  const status = assinatura === 'FORA' ? 'ATIVO' : 'AGUARDANDO_ASSINATURA';
  const comum = {
    title: titulo,
    value: String(input.valor),
    dueDay: input.diaVencimento,
    startDate: input.inicio,
    endDate: input.fim,
    signingDate: input.jaAssinadoEm ?? null,
    status,
    pdfBase64,
    model: input.modelo,
    description: input.objeto.trim() || null,
    paymentTerms: input.formaPagamento.trim() || null,
    adjustmentIndex: input.indice,
    nextAdjustmentDate: input.indice === 'NENHUM' ? null : umAnoDepois(input.inicio),
    signatureMethod: assinatura,
    documentHash: hash,
    verificationCode: codigo,
  };

  const [meu] = await withTenant(ctx.companyId, (tx) =>
    tx
      .insert(businessContract)
      .values({
        ...comum,
        companyId: ctx.companyId,
        type: tipo,
        partyName: ela.nome,
        partyCnpj: normalizeDocument(parte.documento) || null,
        partyEmail: parte.email || null,
        counterpartyCompanyId: outra?.id ?? null,
        autoEmitNfse: tipo === 'ENTRADA' && Boolean(input.emitirNota),
      })
      .returning(),
  );
  if (!meu) return { ok: false, message: 'Não consegui salvar o contrato.' };

  // A outra parte usa a Hexx: o contrato aparece para ela na hora.
  if (outra) {
    const [espelho] = await withTenant(outra.id, (tx) =>
      tx
        .insert(businessContract)
        .values({
          ...comum,
          companyId: outra.id,
          type: ESPELHO[tipo]!,
          partyName: minha.legalName,
          partyCnpj: normalizeDocument(minha.cnpj),
          partyEmail: signatario?.email ?? minha.email ?? null,
          counterpartyCompanyId: ctx.companyId,
          mirrorContractId: meu.id,
          initiatedHere: false,
        })
        .returning(),
    );
    if (espelho) {
      await withTenant(ctx.companyId, (tx) => tx.update(businessContract).set({ mirrorContractId: espelho.id }).where(eq(businessContract.id, meu.id)));
      if (assinatura === 'HUB') {
        await avisar(
          outra.id,
          'Contrato para você assinar',
          `${(minha.tradeName || minha.legalName).trim()} enviou "${titulo}" (${brl(input.valor)}/mês). Abra Contratos para ler e assinar.`,
          'WARNING',
        );
      }
    }
  }

  let linkParaAssinar: string | null = null;
  if (assinatura === 'FORA') {
    await ativarContrato(meu.id);
  } else if (assinatura === 'DOCUSEAL') {
    const papelMeu = souContratada ? 'CONTRATADA' : 'CONTRATANTE';
    const papelDela = souContratada ? 'CONTRATANTE' : 'CONTRATADA';
    const propria = input.modelo === 'PROPRIO';
    // PDF próprio: sem página de assinaturas conhecida — campo no rodapé da última página.
    const area = (papel: 'CONTRATANTE' | 'CONTRATADA') =>
      propria ? { x: papel === 'CONTRATANTE' ? 0.08 : 0.52, y: 0.84, w: 0.4, h: 0.07, page: 'last' as const } : AREAS_DE_ASSINATURA[papel];
    const envio = await makeContractSignatureService().send(ctx, {
      title: titulo,
      documentBuffer: { base64: pdfBase64, filename: `Contrato_${ela.nome.replace(/[^a-z0-9]/gi, '_')}.pdf` },
      signers: [
        { name: parte.nome, email: parte.email, role: papelDela, area: area(papelDela) },
        { name: signatario!.nome, email: signatario!.email, role: papelMeu, area: area(papelMeu), sendEmail: false },
      ],
      subject: { type: 'CONTRACT', id: meu.id },
    });
    linkParaAssinar =
      envio.signUrls.find((u) => u.email.toLowerCase() === signatario!.email.toLowerCase() && u.email.toLowerCase() !== parte.email.toLowerCase())?.url ??
      envio.signUrls[1]?.url ??
      null;
    await withTenant(ctx.companyId, (tx) =>
      tx.update(businessContract).set({ signatureRequestId: envio.id, ownSignUrl: linkParaAssinar }).where(eq(businessContract.id, meu.id)),
    );
  }

  return {
    ok: true,
    id: meu.id,
    assinatura,
    linkParaAssinar,
    message:
      assinatura === 'FORA'
        ? 'Contrato registrado e ativo. As parcelas já estão no financeiro.'
        : assinatura === 'HUB'
          ? `Contrato criado. Falta a sua assinatura e a de ${ela.nome}, que já recebeu o aviso na Hexx.`
          : `Contrato criado e enviado para ${parte.email}. Assine agora pela sua empresa.`,
  };
}

/** Código de 8 letras e números, sem os que se confundem (0/O, 1/I): "K7QX-3MPA". */
async function novoCodigoDeVerificacao(): Promise<string> {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const bruto = Array.from({ length: 8 }, () => letras[randomInt(letras.length)]).join('');
    const codigo = `${bruto.slice(0, 4)}-${bruto.slice(4)}`;
    const [existe] = await getDb().select({ id: businessContract.id }).from(businessContract).where(eq(businessContract.verificationCode, codigo)).limit(1);
    if (!existe) return codigo;
  }
  throw new Error('Não consegui gerar o código de verificação.');
}

/** As assinaturas feitas na Hexx para este contrato e o espelho dele. */
export async function assinaturasNoHub(contratoId: string, espelhoId: string | null) {
  const ids = [contratoId, espelhoId].filter(Boolean) as string[];
  const rows = await getDb()
    .select()
    .from(contractSignature)
    .where(sql`${contractSignature.contractId} IN (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`);
  return rows;
}

/** Assina, pela empresa logada, um contrato cuja assinatura é na Hexx. */
export async function assinarNoHub(
  ctx: TenantContext,
  contratoId: string,
  quem: { nome: string; cpf: string },
  origem: { ip: string | null; userAgent: string | null },
): Promise<{ ok: boolean; message: string; ativou?: boolean }> {
  const [c] = await withTenant(ctx.companyId, (tx) =>
    tx.select().from(businessContract).where(and(eq(businessContract.id, contratoId), eq(businessContract.companyId, ctx.companyId))),
  );
  if (!c) return { ok: false, message: 'Contrato não encontrado.' };
  if (c.signatureMethod !== 'HUB') return { ok: false, message: 'Este contrato é assinado pelo DocuSeal.' };
  if (c.status !== 'AGUARDANDO_ASSINATURA') return { ok: false, message: 'Este contrato não está aguardando assinatura.' };
  const cpf = normalizeDocument(quem.cpf);
  if (!quem.nome.trim()) return { ok: false, message: 'Informe seu nome completo.' };
  if (cpf.length !== 11) return { ok: false, message: 'Informe um CPF válido.' };

  const ja = await assinaturasNoHub(c.id, c.mirrorContractId);
  if (ja.some((a) => a.companyId === ctx.companyId)) return { ok: false, message: 'Sua empresa já assinou este contrato.' };

  const signatario = await quemAssina(ctx);
  await withTenant(ctx.companyId, (tx) =>
    tx.insert(contractSignature).values({
      companyId: ctx.companyId,
      contractId: c.id,
      userId: signatario?.userId ?? null,
      signerName: quem.nome.trim(),
      signerCpf: formatDocument(cpf),
      signerEmail: signatario?.email ?? null,
      ip: origem.ip,
      userAgent: origem.userAgent?.slice(0, 300) ?? null,
      documentHash: c.documentHash ?? '',
    }),
  );

  const outraJaAssinou = ja.some((a) => a.companyId === c.counterpartyCompanyId);
  if (outraJaAssinou) {
    await ativarContrato(c.id);
    return { ok: true, ativou: true, message: 'Assinado. As duas partes assinaram: o contrato está ativo e as parcelas já estão no financeiro.' };
  }
  if (c.counterpartyCompanyId) {
    const [minha] = await getDb().select({ nome: company.tradeName, razao: company.legalName }).from(company).where(eq(company.id, ctx.companyId));
    await avisar(c.counterpartyCompanyId, 'Falta a sua assinatura', `${(minha?.nome || minha?.razao || '').trim()} assinou "${c.title}". Assine para o contrato valer.`, 'WARNING');
  }
  return { ok: true, message: `Assinado. Falta a assinatura de ${c.partyName}.` };
}

/**
 * Ativa o contrato e o espelho: status ATIVO, data de assinatura e as
 * parcelas no financeiro de cada lado. Idempotente — o webhook do DocuSeal
 * pode chegar mais de uma vez.
 */
export async function ativarContrato(contratoId: string) {
  const db = getDb();
  const [c] = await db.select().from(businessContract).where(eq(businessContract.id, contratoId));
  if (!c) return;
  const lados = [c];
  if (c.mirrorContractId) {
    const [e] = await db.select().from(businessContract).where(eq(businessContract.id, c.mirrorContractId));
    if (e) lados.push(e);
  }
  for (const l of lados) {
    if (l.status !== 'ATIVO') {
      await db
        .update(businessContract)
        .set({ status: 'ATIVO', signingDate: l.signingDate ?? hoje(), ownSignUrl: null, updatedAt: new Date() })
        .where(eq(businessContract.id, l.id));
    }
    if (await jaTemLancamentosDoContrato(l.companyId, l.id)) continue;
    await gerarLancamentosDoContrato({
      companyId: l.companyId,
      contractId: l.id,
      tipo: l.type === 'ENTRADA' || l.type === 'MUTUO_ATIVO' ? 'RECEBER' : 'PAGAR',
      descricao: `[Contrato] ${l.title} — ${l.partyName}`,
      valor: Number(l.value),
      dueDay: l.dueDay,
      startDate: l.startDate,
      endDate: l.endDate,
    });
    if (l.initiatedHere === false || lados.length > 1) {
      await avisar(l.companyId, 'Contrato assinado e ativo', `"${l.title}" com ${l.partyName} foi assinado pelas duas partes. As parcelas já estão no financeiro.`);
    }
  }
}

/**
 * Reajusta o contrato (e o espelho): novo valor, as parcelas ainda não pagas
 * a partir de hoje passam a valer o novo valor, e o próximo reajuste vai
 * para daqui a um ano.
 */
export async function reajustarContrato(ctx: TenantContext, contratoId: string, percentual: number) {
  if (!Number.isFinite(percentual) || percentual <= -50 || percentual > 100) return { ok: false, message: 'Percentual inválido.' };
  const db = getDb();
  const [c] = await withTenant(ctx.companyId, (tx) =>
    tx.select().from(businessContract).where(and(eq(businessContract.id, contratoId), eq(businessContract.companyId, ctx.companyId))),
  );
  if (!c) return { ok: false, message: 'Contrato não encontrado.' };
  const novo = Math.round(Number(c.value) * (1 + percentual / 100) * 100) / 100;
  const proximo = umAnoDepois(c.nextAdjustmentDate && c.nextAdjustmentDate <= hoje() ? c.nextAdjustmentDate : hoje());

  const ids = [c.id, c.mirrorContractId].filter(Boolean) as string[];
  for (const id of ids) {
    await db.update(businessContract).set({ value: String(novo), nextAdjustmentDate: proximo, updatedAt: new Date() }).where(eq(businessContract.id, id));
    await db.execute(sql`
      UPDATE financial_entry SET amount = ${novo}
       WHERE source = 'CONTRACT' AND source_id = ${id}::uuid AND status = 'PENDING' AND due_date >= ${hoje()}::date
    `);
  }
  if (c.counterpartyCompanyId) {
    await avisar(c.counterpartyCompanyId, 'Contrato reajustado', `"${c.title}" foi reajustado em ${percentual.toLocaleString('pt-BR')}%: agora ${brl(novo)}/mês nas próximas parcelas.`);
  }
  return { ok: true, message: `Reajustado para ${brl(novo)}/mês. As próximas parcelas já estão com o valor novo.`, novoValor: novo };
}

/**
 * Variação acumulada do índice nos últimos 12 meses (Banco Central, SGS).
 * IPCA = série 433; IGP-M = série 189. `null` se o BC não responder.
 */
export async function indiceAcumulado12m(indice: IndiceDeReajuste): Promise<{ percentual: number; ate: string } | null> {
  const serie = indice === 'IPCA' ? 433 : indice === 'IGPM' ? 189 : null;
  if (!serie) return null;
  try {
    const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${serie}/dados/ultimos/12?formato=json`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const dados = (await res.json()) as { data: string; valor: string }[];
    if (dados.length < 12) return null;
    const fator = dados.reduce((f, d) => f * (1 + Number(d.valor.replace(',', '.')) / 100), 1);
    return { percentual: Math.round((fator - 1) * 10000) / 100, ate: dados[dados.length - 1]!.data.slice(3) };
  } catch {
    return null;
  }
}

export interface Conferencia {
  codigo: string;
  titulo: string;
  status: string;
  assinatura: 'HUB' | 'DOCUSEAL' | 'FORA' | null;
  assinadoEm: string | null;
  vigencia: { inicio: string; fim: string };
  partes: { nome: string; documento: string | null; papel: string }[];
  assinaturas: { empresa: string; nome: string; cpf: string | null; em: string; ip: string | null }[];
  hash: string | null;
}

/**
 * A conferência pública de um contrato, pelo código impresso no PDF. Sem
 * login — por isso só sai o necessário para conferir a autenticidade: as
 * partes, quem assinou e quando, e o hash do arquivo. Valor e cláusulas não.
 */
export async function getConferencia(codigo: string): Promise<Conferencia | null> {
  const limpo = codigo.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (limpo.length !== 8) return null;
  const formatado = `${limpo.slice(0, 4)}-${limpo.slice(4)}`;
  const db = getDb();
  const lados = await db.select().from(businessContract).where(eq(businessContract.verificationCode, formatado));
  const c = lados.find((l) => l.initiatedHere) ?? lados[0];
  if (!c) return null;
  const [emp] = await db.select({ nome: company.legalName, cnpj: company.cnpj }).from(company).where(eq(company.id, c.companyId));

  const souContratada = c.type === 'ENTRADA' || c.type === 'MUTUO_ATIVO';
  const partes = [
    { nome: emp?.nome ?? '—', documento: emp?.cnpj ?? null, papel: souContratada ? 'Contratada' : 'Contratante' },
    { nome: c.partyName, documento: c.partyCnpj ? formatDocument(c.partyCnpj) : null, papel: souContratada ? 'Contratante' : 'Contratada' },
  ].sort((x, y) => (x.papel === 'Contratante' ? 0 : 1) - (y.papel === 'Contratante' ? 0 : 1));

  const assinaturas =
    c.signatureMethod === 'HUB'
      ? (await assinaturasNoHub(c.id, c.mirrorContractId)).map((a) => ({
          empresa: a.companyId === c.companyId ? (emp?.nome ?? '') : c.partyName,
          nome: a.signerName,
          cpf: a.signerCpf ? a.signerCpf.replace(/^\d{3}\.(\d{3})\.(\d{3})-\d{2}$/, '***.$1.$2-**') : null,
          em: a.signedAt.toISOString(),
          ip: a.ip,
        }))
      : [];

  return {
    codigo: formatado,
    titulo: c.title,
    status: c.status,
    assinatura: (c.signatureMethod as Conferencia['assinatura']) ?? null,
    assinadoEm: c.signingDate,
    vigencia: { inicio: c.startDate, fim: c.endDate },
    partes,
    assinaturas,
    hash: c.documentHash,
  };
}
