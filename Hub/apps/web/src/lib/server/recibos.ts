import 'server-only';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { withTenant, sql, getDb } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';
import { validarRecibo, reciboPodeApurar, dataReciboValida, proximaDataRecibo, itensDoRecebimento, validarDiscriminacao, type ReciboItem } from '../recibo-rules';
import { gerarPdfReciboAluguel } from './recibo-aluguel';
import type { ReciboAluguelData } from './recibo-aluguel-pdf';

const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
function conteudoReciboHash(data:ReciboAluguelData,includeSignature=false):string {
  const normalized=JSON.parse(JSON.stringify(data)) as Record<string,unknown>;
  if(!includeSignature)delete normalized.assinatura;
  const canonical=(value:any):any=>Array.isArray(value) ? value.map(canonical) : value && typeof value==='object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
  return createHash('sha256').update(JSON.stringify(canonical(normalized))).digest('hex');
}
const hoje = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const fmt = (s: string | null) => s ? s.slice(0, 10).split('-').reverse().join('/') : null;

export interface ReceiptRow {
  id: string; entryId: string; number: string; amount: number; description: string;
  payer: string; referenceMonth: string; paidAt: string; issuedAt: string;
  fiscalEligible: boolean; oneflowStatus: string; canceled: boolean;
  invoiceNumber?: string | null; itens?: ReciboItem[]; signed?: boolean;
}
export interface ReceiptCandidate {
  id: string; description: string; amount: number; payer: string | null;
  paidAt: string | null; status: string; source: string; leaseId: string | null;
  referenceMonth: string; invoiceNumber: string | null; ownerType?:string|null; itens?: ReciboItem[]; interest?: number; discount?: number;
}
export interface ReceiptScheduleRow {
  id: string; description: string; nextDate: string; recurring: boolean;
  active: boolean; sendEmail: boolean; lastError: string | null;
}

export async function listarRecibos(ctx: TenantContext) {
  return withTenant(ctx.companyId, async (tx) => {
    const receipts = await tx.execute(sql`
      SELECT r.id::text, r.financial_entry_id::text AS "entryId", r.number,
        (r.data->'valores'->>'total')::float AS amount, r.data->>'descricao' AS description,
        r.data->'locatario'->>'nome' AS payer, r.data->>'mesReferencia' AS "referenceMonth", r.data->>'notaFiscal' AS "invoiceNumber",
        r.data->>'dataPagamento' AS "paidAt", to_char(r.created_at AT TIME ZONE 'America/Sao_Paulo','DD/MM/YYYY') AS "issuedAt",
        r.fiscal_eligible AS "fiscalEligible", r.oneflow_status AS "oneflowStatus", r.canceled_at IS NOT NULL AS canceled, r.data ? 'assinatura' AS signed
      FROM payment_receipt r WHERE r.company_id = ${ctx.companyId} ORDER BY r.created_at DESC LIMIT 200
    `);
    const candidates = await tx.execute(sql`
      SELECT fe.id::text, fe.description, fe.amount::float, fe.interest::float, fe.discount::float, fe.receipt_items AS itens, p.owner_type AS "ownerType", coalesce(c.name,d.tomador_nome,bp.name,l.lessee_name,bc.party_name) AS payer,
        to_char(fe.paid_at,'YYYY-MM-DD') AS "paidAt", fe.status, fe.source,
        l.id::text AS "leaseId", to_char(fe.reference_month,'YYYY-MM') AS "referenceMonth",
        coalesce(si.nfse_number,d.numero_nfse) AS "invoiceNumber"
      FROM financial_entry fe
      LEFT JOIN service_invoice si ON fe.source = 'NFSE' AND si.id = fe.source_id AND si.company_id = fe.company_id
      LEFT JOIN nfse_distribuicao_doc d ON fe.source = 'DFE_SYNC' AND d.chave_acesso = fe.external_id AND d.company_id = fe.company_id
      LEFT JOIN customer c ON c.id = si.customer_id AND c.company_id = fe.company_id
      LEFT JOIN business_partner bp ON bp.id = fe.partner_id AND bp.company_id = fe.company_id
      LEFT JOIN lease l ON fe.source = 'RENT' AND l.id = fe.source_id AND l.company_id = fe.company_id
      LEFT JOIN property p ON p.id=l.property_id AND p.company_id=fe.company_id
      LEFT JOIN business_contract bc ON fe.source = 'CONTRACT' AND bc.id = fe.source_id AND bc.company_id = fe.company_id
      WHERE fe.company_id = ${ctx.companyId} AND fe.type = 'RECEIVABLE' AND fe.status <> 'CANCELED'
        AND NOT EXISTS (SELECT 1 FROM payment_receipt r WHERE r.financial_entry_id = fe.id AND r.company_id = fe.company_id)
      ORDER BY fe.due_date DESC LIMIT 200
    `);
    const schedules = await tx.execute(sql`
      SELECT a.id::text, coalesce(fe.description, 'Aluguel — ' || l.lessee_name) AS description,
        to_char(a.next_date, 'YYYY-MM-DD') AS "nextDate", a.day_of_month IS NOT NULL AS recurring,
        a.active, a.send_email AS "sendEmail", a.last_error AS "lastError"
      FROM receipt_schedule a
      LEFT JOIN financial_entry fe ON fe.id = a.financial_entry_id AND fe.company_id = a.company_id
      LEFT JOIN lease l ON l.id = a.lease_id AND l.company_id = a.company_id
      WHERE a.company_id = ${ctx.companyId} ORDER BY a.active DESC, a.next_date
    `);
    const expenses=await tx.execute(sql`SELECT id::text,description,amount::float FROM financial_entry WHERE company_id=${ctx.companyId} AND type='PAYABLE' AND status<>'CANCELED' ORDER BY due_date DESC LIMIT 200`);
    const [signing]=await tx.execute(sql`SELECT a.signer_name AS "signerName" FROM receipt_signature_authorization a
      JOIN membership m ON m.company_id=a.company_id AND m.user_id=a.user_id AND m.role='OWNER' AND m.authorized
      WHERE a.company_id=${ctx.companyId} AND a.revoked_at IS NULL`);
    return { signing: signing ? {signerName:String(signing.signerName)} : null, expenses:expenses as unknown as {id:string;description:string;amount:number}[], receipts: receipts as unknown as ReceiptRow[], candidates: (candidates as unknown as ReceiptCandidate[]).map(c=>({...c,itens:itensDoRecebimento({...c,receipt_items:c.itens})})), schedules: schedules as unknown as ReceiptScheduleRow[] };
  });
}

export async function emitirRecibo(ctx: TenantContext, entryId: string, payerName?: string, sign?:boolean) {
  if (!uuid(entryId)) throw new Error('Recebimento inválido.');
  return withTenant(ctx.companyId, async (tx) => {
    // Serialize manual and cron issuance of the same payment. The unique
    // constraint is a second guard; no duplicate financial entry is created.
    const rows = await tx.execute(sql`
      SELECT a.id AS signature_authorization_id, a.signer_name, fe.*, to_char(fe.paid_at,'YYYY-MM-DD') AS payment_date,
        to_char(fe.due_date,'YYYY-MM-DD') AS due, to_char(fe.reference_month,'YYYY-MM-DD') AS month,
        co.type AS company_type, co.legal_name, co.cnpj, co.email AS company_email,
        concat_ws(', ',co.address_line1,co.address_number,co.city,co.state) AS company_address,
        coalesce(c.name,d.tomador_nome,bp.name,l.lessee_name,bc.party_name) AS payer,
        coalesce(c.document,d.tomador_documento,bp.document,lc.document,bc.party_cnpj) AS payer_document,
        coalesce(c.email,lc.email,bc.party_email) AS payer_email, c.address AS payer_address,
        coalesce(si.nfse_number,d.numero_nfse) AS invoice_number,
        si.status AS invoice_status, d.cancelado AS imported_canceled,
        p.owner_type, p.label AS property_label, p.address AS property_address, pt.name AS owner_name, pt.cpf AS owner_document
      FROM financial_entry fe
      JOIN company co ON co.id = fe.company_id
      LEFT JOIN receipt_signature_authorization a ON a.company_id=fe.company_id AND a.revoked_at IS NULL
        AND EXISTS (SELECT 1 FROM membership m WHERE m.company_id=a.company_id AND m.user_id=a.user_id AND m.role='OWNER' AND m.authorized)
      LEFT JOIN service_invoice si ON fe.source = 'NFSE' AND si.id = fe.source_id AND si.company_id = fe.company_id
      LEFT JOIN nfse_distribuicao_doc d ON fe.source = 'DFE_SYNC' AND d.chave_acesso = fe.external_id AND d.company_id = fe.company_id
      LEFT JOIN customer c ON c.id = si.customer_id AND c.company_id = fe.company_id
      LEFT JOIN business_partner bp ON bp.id = fe.partner_id AND bp.company_id = fe.company_id
      LEFT JOIN lease l ON fe.source = 'RENT' AND l.id = fe.source_id AND l.company_id = fe.company_id
      LEFT JOIN property p ON p.id = l.property_id AND p.company_id = fe.company_id
      LEFT JOIN partner pt ON pt.id = p.partner_id AND pt.company_id = fe.company_id
      LEFT JOIN LATERAL (
        SELECT document, email FROM customer cc WHERE cc.company_id = fe.company_id AND lower(trim(cc.name)) = lower(trim(l.lessee_name))
          AND (SELECT count(*) FROM customer unique_c WHERE unique_c.company_id = fe.company_id AND lower(trim(unique_c.name)) = lower(trim(l.lessee_name))) = 1
      ) lc ON TRUE
      LEFT JOIN business_contract bc ON fe.source = 'CONTRACT' AND bc.id = fe.source_id AND bc.company_id = fe.company_id
      WHERE fe.id = ${entryId}::uuid AND fe.company_id = ${ctx.companyId} AND co.closed_at IS NULL
      FOR UPDATE OF fe, co
    `);
    const r = rows[0] as Record<string, any> | undefined;
    if (!r) throw new Error('Recebimento não encontrado nesta empresa.');
    const [existing] = await tx.execute(sql`SELECT id::text, canceled_at FROM payment_receipt WHERE company_id = ${ctx.companyId} AND financial_entry_id = ${entryId}::uuid`);
    if (existing) {
      if (existing.canceled_at) throw new Error('Este recibo foi cancelado. Consulte o histórico antes de emitir novamente.');
      return { id: String(existing.id), alreadyIssued: true };
    }
    const rule = { companyType: r.company_type, source: r.source, type: r.type, status: r.status, paidAt: r.payment_date, amount: Number(r.amount), ownerType: r.owner_type };
    const error = validarRecibo(rule);
    if (error) throw new Error(error);
    if (r.invoice_status && r.invoice_status !== 'ISSUED' || r.imported_canceled) throw new Error('A nota vinculada não está válida. Revise o recebimento antes de emitir.');
    const payer = String(r.payer || payerName || '').trim();
    if (!payer) throw new Error('Informe o nome de quem pagou ou vincule um cliente ao recebimento.');
    if (r.source === 'RENT' && !r.property_label) throw new Error('O imóvel deste aluguel não foi encontrado.');
    if (r.source === 'RENT' && r.owner_type === 'PF' && !r.owner_name) throw new Error('Vincule o proprietário do imóvel antes de emitir o recibo.');
    const id = randomUUID();
    const number = `REC-${hoje().replaceAll('-','')}-${id.replaceAll('-','').slice(0,12).toUpperCase()}`;
    const token=randomBytes(32).toString('hex');
    const origin=process.env.RECEIPT_PUBLIC_URL || (process.env.NODE_ENV !== 'production' ? 'http://127.0.0.1:3001' : '');
    if (!origin || !/^https?:\/\//.test(origin)) throw new Error('Configure RECEIPT_PUBLIC_URL para gerar o QR de consulta do recibo.');
    const data: ReciboAluguelData = {
      itens:itensDoRecebimento(r as any), urlVerificacao:new URL(`/recibo/verificar/${token}`,origin).href,
      tipo: r.source === 'RENT' ? 'LOCACAO' : 'PAGAMENTO',
      numeroRecibo: number, descricao: r.description, notaFiscal: r.invoice_number,
      mesReferencia: r.month.slice(0,7).split('-').reverse().join('/'),
      dataVencimento: fmt(r.due)!, dataPagamento: fmt(r.payment_date), status: 'PAID',
      locador: { nome: r.owner_type === 'PF' ? r.owner_name : r.legal_name, documento: r.owner_type === 'PF' ? (r.owner_document || 'Não informado') : r.cnpj, endereco: r.owner_type === 'PF' ? 'Não informado' : (r.company_address || 'Não informado'), email: r.owner_type === 'PF' ? null : r.company_email },
      locatario: { nome: payer, documento: r.payer_document || 'Não informado', endereco: r.payer_address, email: r.payer_email },
      imovel: { label: r.property_label || r.description, endereco: r.property_address || '' },
      valores: { aluguel: Number(r.amount), total: Number(r.amount) },
      cidadeData: `Emitido em ${fmt(hoje())}`, codigoVerificacao: number,
    };
    // An owner explicitly authorized future automatic receipts. Never sign a
    // personal property owner's receipt using the company's authorization.
    const canSign=!!r.signature_authorization_id && !(r.source==='RENT' && r.owner_type==='PF');
    if(sign===true && !canSign)throw new Error('A assinatura requer uma autorização vigente do responsável pelo recebedor. Configure a assinatura ou emita sem assinar.');
    if (sign!==false && canSign) {
      data.assinatura={metodo:'HUB',nome:r.signer_name,em:new Date().toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}),
        autorizacaoId:String(r.signature_authorization_id),conteudoHash:conteudoReciboHash(data)};
    }
    const pdf = await gerarPdfReciboAluguel(data);
    const eligible = reciboPodeApurar(rule);
    await tx.execute(sql`
      INSERT INTO payment_receipt (id,company_id,financial_entry_id,number,data,pdf_base64,fiscal_eligible,oneflow_status,verification_hash,pdf_hash,snapshot_hash)
      VALUES (${id}::uuid,${ctx.companyId},${entryId}::uuid,${number},${JSON.stringify(data)}::jsonb,${pdf.toString('base64')},${eligible},${eligible ? 'AGUARDANDO_CONFIGURACAO' : 'NAO_APLICAVEL'},${createHash('sha256').update(token).digest('hex')},${createHash('sha256').update(pdf).digest('hex')},${conteudoReciboHash(data,true)})
    `);
    return { id, alreadyIssued: false };
  });
}

export async function obterRecibo(ctx: TenantContext, id: string) {
  if (!uuid(id)) return null;
  const [r] = await withTenant(ctx.companyId, tx => tx.execute(sql`
    SELECT id::text, number, data, pdf_base64, canceled_at, oneflow_status
    FROM payment_receipt WHERE id = ${id}::uuid AND company_id = ${ctx.companyId}
  `));
  return r as { id: string; number: string; data: ReciboAluguelData; pdf_base64: string; canceled_at: string | null; oneflow_status: string } | undefined;
}

export async function compartilharRecibo(ctx: TenantContext, id: string) {
  const r = await obterRecibo(ctx, id);
  if (!r || r.canceled_at) throw new Error('Recibo não encontrado ou cancelado.');
  const token = randomBytes(32).toString('hex');
  await withTenant(ctx.companyId, tx => tx.execute(sql`
    INSERT INTO receipt_share (company_id,receipt_id,token_hash,expires_at)
    VALUES (${ctx.companyId},${id}::uuid,${createHash('sha256').update(token).digest('hex')},now() + interval '7 days')
  `));
  return `/r/${token}`;
}

export async function cancelarRecibo(ctx: TenantContext, id: string, reason: string) {
  if (!uuid(id) || reason.trim().length < 5) throw new Error('Informe o motivo do cancelamento (mínimo de 5 caracteres).');
  const rows = await withTenant(ctx.companyId, tx => tx.execute(sql`
    UPDATE payment_receipt SET canceled_at = now(), cancel_reason = ${reason.trim()}
    WHERE id = ${id}::uuid AND company_id = ${ctx.companyId} AND canceled_at IS NULL
      AND oneflow_status IN ('NAO_APLICAVEL','AGUARDANDO_CONFIGURACAO','PENDENTE','ERRO') RETURNING id
  `));
  if (!rows.length) throw new Error('Recibo não encontrado, cancelado ou com envio fiscal que precisa ser conferido pelo escritório.');
}

export async function agendarRecibo(ctx: TenantContext, p: { entryId: string; date: string; recurring: boolean; sendEmail: boolean }) {
  if (!uuid(p.entryId) || !dataReciboValida(p.date) || p.date < hoje()) throw new Error('Selecione um recebimento e uma data válida de hoje em diante.');
  return withTenant(ctx.companyId, async tx => {
    const [fe] = await tx.execute(sql`SELECT fe.source, fe.source_id::text, l.status AS lease_status FROM financial_entry fe
      LEFT JOIN lease l ON l.id = fe.source_id AND l.company_id = fe.company_id AND fe.source = 'RENT'
      WHERE fe.id = ${p.entryId}::uuid AND fe.company_id = ${ctx.companyId} AND fe.type = 'RECEIVABLE' AND fe.status <> 'CANCELED'`);
    if (!fe) throw new Error('Recebimento não encontrado.');
    if (p.recurring && (fe.source !== 'RENT' || fe.lease_status !== 'ACTIVE')) throw new Error('A recorrência exige um contrato de aluguel ativo.');
    const leaseId = p.recurring ? String(fe.source_id) : null;
    // Serialize setup on its parent entity, including concurrent requests.
    if (leaseId) await tx.execute(sql`SELECT id FROM lease WHERE id = ${leaseId}::uuid AND company_id = ${ctx.companyId} FOR UPDATE`);
    else await tx.execute(sql`SELECT id FROM financial_entry WHERE id = ${p.entryId}::uuid AND company_id = ${ctx.companyId} FOR UPDATE`);
    const [active] = await tx.execute(sql`SELECT id FROM receipt_schedule WHERE company_id = ${ctx.companyId} AND active
      AND (financial_entry_id = ${p.entryId}::uuid OR lease_id = ${leaseId}::uuid)`);
    if (active) throw new Error('Já existe um agendamento ativo para este recebimento ou aluguel.');
    await tx.execute(sql`INSERT INTO receipt_schedule(company_id,financial_entry_id,lease_id,next_date,day_of_month,send_email)
      VALUES (${ctx.companyId},${p.recurring ? null : p.entryId}::uuid,${leaseId}::uuid,${p.date}::date,${p.recurring ? Number(p.date.slice(8)) : null},${p.sendEmail})`);
  });
}

export async function alterarAgendaRecibo(ctx: TenantContext, id: string, active: boolean) {
  if (!uuid(id)) throw new Error('Agendamento inválido.');
  await withTenant(ctx.companyId, tx => tx.execute(sql`UPDATE receipt_schedule SET active = ${active} WHERE id = ${id}::uuid AND company_id = ${ctx.companyId}`));
}

export async function rodarRecibosAgendados() {
  const db = getDb();
  const date = hoje();
  const schedules = await db.execute(sql`SELECT a.*, c.type AS company_type FROM receipt_schedule a JOIN company c ON c.id = a.company_id
    WHERE a.active AND a.next_date <= ${date}::date AND c.closed_at IS NULL
    ORDER BY coalesce(a.last_run, '1970-01-01'::date), a.next_date LIMIT 100`);
  const out = { emitted: 0, errors: [] as string[] };
  for (const a of schedules) {
    const ctx = { companyId: String(a.company_id), companyType: a.company_type, userId: 'cron' } as TenantContext;
    const scheduledDate = String(a.next_date).slice(0,10);
    try {
      let entryId = a.financial_entry_id ? String(a.financial_entry_id) : null;
      if (a.lease_id) {
        const entries = await withTenant(ctx.companyId, tx => tx.execute(sql`SELECT fe.id::text FROM financial_entry fe
          JOIN lease l ON l.id = fe.source_id AND l.company_id = fe.company_id
          WHERE fe.company_id = ${ctx.companyId} AND fe.source = 'RENT' AND fe.source_id = ${String(a.lease_id)}::uuid
            AND fe.type = 'RECEIVABLE' AND fe.reference_month = ${scheduledDate.slice(0,7) + '-01'}::date
            AND fe.status <> 'CANCELED' AND l.status = 'ACTIVE'`));
        if (entries.length !== 1) throw new Error('Não foi possível identificar uma única parcela do aluguel neste mês.');
        entryId = String(entries[0]!.id);
      }
      if (!entryId) throw new Error('Recebimento não encontrado.');
      const r = await emitirRecibo(ctx, entryId);
      if (!r.alreadyIssued) out.emitted++;
      if (a.send_email) {
        const { enviarReciboEmitidoEmail } = await import('./recibo-envio');
        const result = await enviarReciboEmitidoEmail(ctx, r.id, undefined, `agenda:${a.id}:${scheduledDate}`);
        if (!result.ok) throw new Error(`Recibo emitido; envio por e-mail pendente: ${result.message}`);
      }
      const next = a.day_of_month ? proximaDataRecibo(scheduledDate, Number(a.day_of_month)) : scheduledDate;
      await withTenant(ctx.companyId, tx => tx.execute(sql`UPDATE receipt_schedule SET next_date = ${next}::date,
        active = ${!!a.day_of_month}, last_error = NULL, last_run = ${date}::date
        WHERE id = ${String(a.id)}::uuid AND company_id = ${ctx.companyId} AND next_date = ${scheduledDate}::date`));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      out.errors.push(message);
      // Keep the occurrence pending; neither a payment nor a failed PDF is skipped.
      await withTenant(ctx.companyId, tx => tx.execute(sql`UPDATE receipt_schedule SET last_error = ${message}, last_run = ${date}::date WHERE id = ${String(a.id)}::uuid AND company_id = ${ctx.companyId}`));
    }
  }
  return out;
}

export async function salvarDiscriminacao(ctx: TenantContext,id:string,items:ReciboItem[]) {
  if (!uuid(id)) throw new Error('Recebimento inválido.');
  await withTenant(ctx.companyId,async tx=>{
    const [fe]=await tx.execute(sql`SELECT amount FROM financial_entry WHERE id=${id}::uuid AND company_id=${ctx.companyId} AND type='RECEIVABLE' AND status<>'CANCELED' FOR UPDATE`);
    if (!fe) throw new Error('Recebimento não encontrado.');
    const [issued]=await tx.execute(sql`SELECT id FROM payment_receipt WHERE financial_entry_id=${id}::uuid AND company_id=${ctx.companyId}`);
    if (issued) throw new Error('Um recibo emitido não pode ser alterado.');
    const clean=validarDiscriminacao(items,Number(fe.amount));
    for(const item of clean.filter(i=>i.despesaId)) {
      const [expense]=await tx.execute(sql`SELECT amount FROM financial_entry WHERE id=${item.despesaId}::uuid AND company_id=${ctx.companyId} AND type='PAYABLE' AND status<>'CANCELED' FOR SHARE`);
      if (!expense || item.valor>Number(expense.amount)) throw new Error('A despesa não pertence à empresa ou o valor supera o lançamento.');
    }
    await tx.execute(sql`UPDATE financial_entry SET receipt_items=${JSON.stringify(clean)}::jsonb WHERE id=${id}::uuid AND company_id=${ctx.companyId}`);
  });
}
export async function consultarReciboPublico(token:string) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const [r]=await getDb().execute(sql`SELECT r.number,r.data->'locador'->>'nome' AS issuer,
    r.data->>'mesReferencia' AS reference,(r.data->'valores'->>'total')::float AS amount,
    r.data AS snapshot,r.snapshot_hash, r.pdf_base64, r.pdf_hash, r.data->'assinatura' AS signature, r.data->>'dataPagamento' AS paid, r.canceled_at IS NOT NULL OR fe.status<>'PAID' OR fe.paid_at IS NULL AS canceled
    FROM payment_receipt r JOIN financial_entry fe ON fe.id=r.financial_entry_id AND fe.company_id=r.company_id
    WHERE r.verification_hash=${createHash('sha256').update(token).digest('hex')}`);
  if(!r)return null;
  const signature=r.signature as ReciboAluguelData['assinatura'];
  const intact=(!r.snapshot_hash || r.snapshot_hash===conteudoReciboHash(r.snapshot as ReciboAluguelData,true)) && (!signature || (r.snapshot && signature.conteudoHash===conteudoReciboHash(r.snapshot as ReciboAluguelData))) && !!r.pdf_hash && createHash('sha256').update(Buffer.from(String(r.pdf_base64),'base64')).digest('hex')===r.pdf_hash;
  return {number:String(r.number),issuer:String(r.issuer),reference:String(r.reference),amount:Number(r.amount),paid:String(r.paid),
    canceled:!!r.canceled || (!!(r.pdf_hash || signature) && !intact), signature:signature && intact ? {name:signature.nome,date:signature.em} : null};
}

export const RECEIPT_SIGNATURE_CONSENT='Autorizo o Hub a assinar eletronicamente os futuros recibos desta empresa em meu nome, inclusive emissões agendadas. Confirmo que represento o recebedor. A autorização vale até ser desativada e não inclui bens pessoais dos sócios.';
export async function configurarAssinaturaRecibos(ctx:TenantContext,enable:boolean,consent:boolean,origin:{ip:string|null;userAgent:string|null}) {
 if(!uuid(ctx.userId)) throw new Error('Entre com seu usuário pessoal para autorizar a assinatura automática.');
 await withTenant(ctx.companyId,async tx=>{
  await tx.execute(sql`SELECT id FROM company WHERE id=${ctx.companyId} FOR UPDATE`);
  const [user]=await tx.execute(sql`SELECT u.name,u.cpf,u.email FROM app_user u JOIN membership m ON m.user_id=u.id
    WHERE m.company_id=${ctx.companyId} AND u.id=${ctx.userId}::uuid AND m.role='OWNER' AND m.authorized`);
  if(!user)throw new Error('Somente o responsável da empresa, com cadastro aprovado, pode configurar esta autorização.');
  if(enable && (!consent || !user.name || String(user.cpf || '').replace(/\D/g,'').length!==11))throw new Error('Confirme a autorização e complete o nome e CPF do seu cadastro.');
  const [active]=await tx.execute(sql`SELECT id FROM receipt_signature_authorization WHERE company_id=${ctx.companyId} AND revoked_at IS NULL`);
  if(enable && active)throw new Error('A assinatura automática já está autorizada. Desative antes de trocar o responsável.');
  if(enable) await tx.execute(sql`INSERT INTO receipt_signature_authorization(company_id,user_id,signer_name,signer_cpf,signer_email,consent_text,ip,user_agent)
    VALUES(${ctx.companyId},${ctx.userId}::uuid,${String(user.name)},${String(user.cpf)},${String(user.email)},${RECEIPT_SIGNATURE_CONSENT},${origin.ip},${origin.userAgent?.slice(0,300) || null})`);
  else await tx.execute(sql`UPDATE receipt_signature_authorization SET revoked_at=now(),revoked_by=${ctx.userId}::uuid WHERE company_id=${ctx.companyId} AND revoked_at IS NULL`);
 });
}

export async function opcoesAssinaturaRecibo(ctx:TenantContext,entryId:string) {
 if(!uuid(entryId))throw new Error('Recebimento inválido.');
 const [row]=await withTenant(ctx.companyId,tx=>tx.execute(sql`SELECT a.signer_name AS "signerName",p.owner_type AS "ownerType",fe.source
 FROM financial_entry fe
 LEFT JOIN lease l ON l.id=fe.source_id AND l.company_id=fe.company_id AND fe.source='RENT'
 LEFT JOIN property p ON p.id=l.property_id AND p.company_id=fe.company_id
 LEFT JOIN receipt_signature_authorization a ON a.company_id=fe.company_id AND a.revoked_at IS NULL
  AND EXISTS(SELECT 1 FROM membership m WHERE m.company_id=a.company_id AND m.user_id=a.user_id AND m.role='OWNER' AND m.authorized)
 WHERE fe.id=${entryId}::uuid AND fe.company_id=${ctx.companyId} AND fe.type='RECEIVABLE'`));
 if(!row)throw new Error('Recebimento não encontrado.');
 return {canSign:!!row.signerName && !(row.source==='RENT' && row.ownerType==='PF'),signerName:row.signerName ? String(row.signerName):null};
}
