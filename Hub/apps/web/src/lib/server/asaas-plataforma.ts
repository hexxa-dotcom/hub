import 'server-only';
import { getDb, sql } from '@hexxa/db';
import { decryptSecret } from './secret-crypto';

/**
 * ASAAS DA PLATAFORMA — a Hexx cobrando os honorários dos clientes.
 *
 * (O Asaas "do cliente", em cobrancas-asaas.ts, é outro: serve para o cliente
 * cobrar os clientes DELE.)
 *
 * - Fatura do mês: boleto com Pix, valor cheio, criado quando a fatura nasce.
 * - Cartão: cobrança criada sob demanda com o desconto do cartão; a página do
 *   Asaas recebe o cartão (o Hub nunca vê o número). Pago o cartão, o boleto
 *   da mesma fatura é cancelado.
 * - Anual no cartão: o ano em até 12× (valor anual do plano); cobre as
 *   faturas até `subscription.paid_until`.
 *
 * `externalReference` diz o que cada cobrança paga: `fatura:<id>`,
 * `fatura:<id>:cartao` ou `anual:<subscriptionId>`.
 */

interface Conexao {
  base: string;
  chave: string;
  descontoCartao: number;
}

export async function conexaoAsaas(): Promise<Conexao | null> {
  const [cfg] = (await getDb()
    .execute(sql`SELECT env, api_key_encrypted, card_discount_percent::float AS desconto FROM platform_asaas_config LIMIT 1`)
    .catch(() => [])) as unknown as { env: string; api_key_encrypted: string | null; desconto: number }[];
  const chave = decryptSecret(cfg?.api_key_encrypted) || process.env.ASAAS_API_KEY || null;
  if (!chave) return null;
  const producao = cfg ? cfg.env === 'production' : process.env.ASAAS_ENV === 'production';
  // No site no ar, cobrança de teste (sandbox) nunca chega a cliente real: sem
  // chave de produção, o checkout fica desligado — como se não houvesse Asaas.
  if (process.env.VERCEL_ENV === 'production' && !producao) return null;
  return {
    base: producao ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3',
    chave,
    descontoCartao: cfg?.desconto ?? 5,
  };
}

async function asaas<T>(c: Conexao, metodo: 'GET' | 'POST' | 'DELETE', caminho: string, corpo?: unknown): Promise<T> {
  const r = await fetch(`${c.base}${caminho}`, {
    method: metodo,
    headers: { access_token: c.chave, 'Content-Type': 'application/json', 'User-Agent': 'HexxGestaoDigital/1.0' },
    body: corpo ? JSON.stringify(corpo) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  const j = (await r.json().catch(() => ({}))) as { errors?: { description?: string }[] } & T;
  if (!r.ok) throw new Error(j.errors?.map((e) => e.description).join('; ') || `Asaas ${r.status}`);
  return j;
}

const hojeSP = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const centavos = (v: number) => Math.round(v * 100) / 100;

/** O cliente da empresa no Asaas — cria na primeira vez e guarda na assinatura. */
async function clienteAsaas(c: Conexao, companyId: string): Promise<string> {
  const [s] = (await getDb().execute(sql`
    SELECT s.id::text, s.asaas_customer_id, c.legal_name, c.cnpj, c.email
      FROM subscription s JOIN company c ON c.id = s.company_id
     WHERE s.company_id = ${companyId} AND s.status <> 'CANCELED' LIMIT 1
  `)) as unknown as { id: string; asaas_customer_id: string | null; legal_name: string; cnpj: string; email: string | null }[];
  if (!s) throw new Error('Empresa sem assinatura ativa.');
  if (s.asaas_customer_id) return s.asaas_customer_id;
  const novo = await asaas<{ id: string }>(c, 'POST', '/customers', {
    name: s.legal_name,
    cpfCnpj: s.cnpj.replace(/\D/g, ''),
    email: s.email ?? undefined,
    externalReference: companyId,
    notificationDisabled: false,
  });
  await getDb().execute(sql`UPDATE subscription SET asaas_customer_id = ${novo.id} WHERE id = ${s.id}`);
  return novo.id;
}

interface Pagamento {
  id: string;
  status: string;
  invoiceUrl: string;
  bankSlipUrl?: string | null;
  billingType?: string;
}

/** Boleto (com Pix) da fatura, pelo valor cheio. Idempotente. */
export async function boletoDaFatura(faturaId: string): Promise<{ ok: boolean; mensagem?: string }> {
  const c = await conexaoAsaas();
  if (!c) return { ok: false, mensagem: 'Asaas da plataforma não configurado.' };
  const [f] = (await getDb().execute(sql`
    SELECT id::text, company_id::text, description, value::float AS valor, to_char(due_date, 'YYYY-MM-DD') AS venc, status, asaas_payment_id
      FROM accounting_invoice WHERE id = ${faturaId}
  `)) as unknown as { id: string; company_id: string; description: string; valor: number; venc: string; status: string; asaas_payment_id: string | null }[];
  if (!f || f.status === 'PAID' || f.asaas_payment_id) return { ok: true };
  const customer = await clienteAsaas(c, f.company_id);
  // Boleto não aceita vencimento no passado: fatura atrasada vence hoje.
  const dueDate = f.venc < hojeSP() ? hojeSP() : f.venc;
  const p = await asaas<Pagamento>(c, 'POST', '/payments', {
    customer, billingType: 'BOLETO', value: centavos(f.valor), dueDate,
    description: f.description, externalReference: `fatura:${f.id}`,
  });
  const pix = await asaas<{ payload?: string }>(c, 'GET', `/payments/${p.id}/pixQrCode`).catch(() => ({ payload: undefined }));
  await getDb().execute(sql`
    UPDATE accounting_invoice
       SET asaas_payment_id = ${p.id}, asaas_invoice_url = ${p.invoiceUrl}, asaas_boleto_url = ${p.bankSlipUrl ?? null},
           pix_code = coalesce(${pix.payload ?? null}, pix_code)
     WHERE id = ${f.id}
  `);
  return { ok: true };
}

/** Cobrança no cartão da fatura, com o desconto do cartão. Devolve a página de pagamento. */
export async function cartaoDaFatura(faturaId: string, companyId: string): Promise<{ ok: boolean; url?: string; mensagem?: string }> {
  const c = await conexaoAsaas();
  if (!c) return { ok: false, mensagem: 'Pagamento com cartão ainda não está disponível.' };
  const [f] = (await getDb().execute(sql`
    SELECT id::text, description, value::float AS valor, status, asaas_card_payment_id, asaas_card_url
      FROM accounting_invoice WHERE id = ${faturaId} AND company_id = ${companyId}
  `)) as unknown as { id: string; description: string; valor: number; status: string; asaas_card_payment_id: string | null; asaas_card_url: string | null }[];
  if (!f) return { ok: false, mensagem: 'Fatura não encontrada.' };
  if (f.status === 'PAID') return { ok: false, mensagem: 'Esta fatura já está paga.' };
  if (f.asaas_card_url) return { ok: true, url: f.asaas_card_url };
  const customer = await clienteAsaas(c, companyId);
  const valor = centavos(f.valor * (1 - c.descontoCartao / 100));
  const p = await asaas<Pagamento>(c, 'POST', '/payments', {
    customer, billingType: 'CREDIT_CARD', value: valor, dueDate: hojeSP(),
    description: `${f.description} — no cartão (${c.descontoCartao}% de desconto)`,
    externalReference: `fatura:${f.id}:cartao`,
  });
  await getDb().execute(sql`UPDATE accounting_invoice SET asaas_card_payment_id = ${p.id}, asaas_card_url = ${p.invoiceUrl} WHERE id = ${f.id}`);
  return { ok: true, url: p.invoiceUrl };
}

/** Desconto do anual para quem tem valor combinado ou desconto (não usa a tabela). */
const DESCONTO_ANUAL_COMBINADO = 0.10;

/**
 * Valor mensal no anual: o da tabela do plano (`valorAnualMensal`); para quem
 * paga valor combinado ou tem desconto, 10% sobre o que já paga — a tabela
 * anual não se aplica a um preço que já não é o da tabela.
 */
export function valorAnualMensal(p: {
  valorMensal: number;
  valorCombinado: string | number | null;
  desconto: string | number | null;
  features: { valorAnualMensal?: number } | null;
}): number | null {
  const personalizado = p.valorCombinado != null || Number(p.desconto ?? 0) > 0;
  if (!personalizado && typeof p.features?.valorAnualMensal === 'number') return p.features.valorAnualMensal;
  if (p.valorMensal <= 0) return null;
  return centavos(p.valorMensal * (1 - DESCONTO_ANUAL_COMBINADO));
}

/** O ano inteiro no cartão, em até 12×, pelo valor anual do plano. */
export async function anualNoCartao(companyId: string): Promise<{ ok: boolean; url?: string; mensagem?: string }> {
  const c = await conexaoAsaas();
  if (!c) return { ok: false, mensagem: 'Pagamento com cartão ainda não está disponível.' };
  const [s] = (await getDb().execute(sql`
    SELECT s.id::text, s.billing_cycle, s.paid_until::text, s.asaas_annual_url, p.features,
           p.monthly_value::float AS tabela, s.custom_value, s.discount_value
      FROM subscription s JOIN plan p ON p.id = s.plan_id
     WHERE s.company_id = ${companyId} AND s.status <> 'CANCELED' LIMIT 1
  `)) as unknown as {
    id: string; billing_cycle: string; paid_until: string | null; asaas_annual_url: string | null;
    features: { valorAnualMensal?: number; nomeComercial?: string } | null; tabela: number; custom_value: string | null; discount_value: string | null;
  }[];
  const mensalHoje = s ? (s.custom_value != null ? Number(s.custom_value) : Math.max(0, s.tabela - Number(s.discount_value ?? 0))) : 0;
  const mensal = s ? valorAnualMensal({ valorMensal: mensalHoje, valorCombinado: s.custom_value, desconto: s.discount_value, features: s.features }) : null;
  if (!s || !mensal) return { ok: false, mensagem: 'O plano não tem opção anual.' };
  if (s.paid_until && s.paid_until >= hojeSP()) return { ok: false, mensagem: 'O ano já está pago.' };
  if (s.asaas_annual_url) return { ok: true, url: s.asaas_annual_url };
  const customer = await clienteAsaas(c, companyId);
  const p = await asaas<Pagamento>(c, 'POST', '/payments', {
    customer, billingType: 'CREDIT_CARD', dueDate: hojeSP(),
    installmentCount: 12, installmentValue: centavos(mensal),
    description: `Plano ${s.features?.nomeComercial ?? ''} — anual no cartão (12× de R$ ${mensal.toFixed(2).replace('.', ',')})`,
    externalReference: `anual:${s.id}`,
  });
  await getDb().execute(sql`UPDATE subscription SET asaas_annual_payment_id = ${p.id}, asaas_annual_url = ${p.invoiceUrl} WHERE id = ${s.id}`);
  return { ok: true, url: p.invoiceUrl };
}

/**
 * Cobrança do pedido feito no site (checkout de hexxdigital.com.br).
 * - Anual: 12× no cartão, na página do Asaas.
 * - Mês a mês: a primeira mensalidade (Pix, boleto ou cartão com desconto).
 *   As seguintes saem pelas faturas de honorários do Hub, depois que o
 *   escritório ativa o cliente — assim não há duas cobranças do mesmo mês.
 * Devolve null sem Asaas disponível (em produção, só com chave de produção).
 */
export async function cobrancaDoPedido(pedidoId: string): Promise<
  { paginaDoCartao?: string; pix?: { copiaECola: string; imagem: string | null }; boletoUrl?: string } | null
> {
  const c = await conexaoAsaas();
  if (!c) return null;
  const db = getDb();
  const [p] = (await db.execute(sql`
    SELECT id::text, plano, cobranca, metodo, nome, cpf, cnpj, razao_social, email, telefone, valor::float AS valor, parcelas
      FROM pedido_do_site WHERE id = ${pedidoId}
  `)) as unknown as {
    id: string; plano: string; cobranca: 'anual' | 'mensal'; metodo: 'pix' | 'boleto' | 'cartao'; nome: string; cpf: string;
    cnpj: string | null; razao_social: string | null; email: string; telefone: string; valor: number; parcelas: number;
  }[];
  if (!p) return null;

  const cliente = await asaas<{ id: string }>(c, 'POST', '/customers', {
    name: p.razao_social ?? p.nome,
    cpfCnpj: p.cnpj ?? p.cpf,
    email: p.email,
    mobilePhone: p.telefone,
    externalReference: `pedido:${p.id}`,
    notificationDisabled: false,
  });
  const nomeDoPlano = { mei: 'MEI', 'sem-movimento': 'Sem movimento', 'simples-light': 'Simples Light', 'simples-completo': 'Simples Completo', presumido: 'Presumido' }[p.plano] ?? p.plano;
  const base = { customer: cliente.id, externalReference: `pedido:${p.id}` };
  // Boleto vence em 3 dias; Pix e cartão, hoje.
  const venc = new Date(Date.now() + (p.metodo === 'boleto' ? 3 : 0) * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  const pg = p.cobranca === 'anual'
    ? await asaas<Pagamento>(c, 'POST', '/payments', {
        ...base, billingType: 'CREDIT_CARD', dueDate: hojeSP(), installmentCount: 12, installmentValue: centavos(p.valor),
        description: `Hexx Digital · Plano ${nomeDoPlano} anual (12× de R$ ${p.valor.toFixed(2).replace('.', ',')})`,
      })
    : await asaas<Pagamento>(c, 'POST', '/payments', {
        ...base, billingType: p.metodo === 'pix' ? 'PIX' : p.metodo === 'boleto' ? 'BOLETO' : 'CREDIT_CARD', dueDate: venc, value: centavos(p.valor),
        description: `Hexx Digital · Plano ${nomeDoPlano} · primeira mensalidade${p.metodo === 'cartao' ? ' (cartão, 5% de desconto)' : ''}`,
      });

  const pix = p.metodo === 'pix'
    ? await asaas<{ payload?: string; encodedImage?: string }>(c, 'GET', `/payments/${pg.id}/pixQrCode`).catch(() => ({ payload: undefined, encodedImage: undefined }))
    : null;

  await db.execute(sql`
    UPDATE pedido_do_site
       SET asaas_customer_id = ${cliente.id}, asaas_payment_id = ${pg.id}, asaas_invoice_url = ${pg.invoiceUrl},
           asaas_boleto_url = ${pg.bankSlipUrl ?? null}, pix_payload = ${pix?.payload ?? null}, pix_imagem = ${pix?.encodedImage ?? null}
     WHERE id = ${p.id}
  `);

  if (p.metodo === 'cartao') return { paginaDoCartao: pg.invoiceUrl };
  if (p.metodo === 'pix' && pix?.payload) return { pix: { copiaECola: pix.payload, imagem: pix.encodedImage ? `data:image/png;base64,${pix.encodedImage}` : null } };
  return { boletoUrl: pg.bankSlipUrl ?? pg.invoiceUrl };
}

const PAGO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

/**
 * Aplica um pagamento confirmado — pelo webhook ou pela consulta. Idempotente.
 * Fatura: marca paga e cancela a outra forma (boleto ↔ cartão). Anual: cobre
 * 12 meses a partir do mês corrente e dá como pagas as faturas abertas.
 */
export async function aplicarPagamento(c: Conexao, p: { id: string; status: string; externalReference?: string | null; billingType?: string }): Promise<boolean> {
  if (!PAGO.has(p.status) || !p.externalReference) return false;
  const db = getDb();
  const [tipo, id, cartao] = p.externalReference.split(':');
  if (tipo === 'pedido' && id) {
    // Pedido do site pago: fica na lista de novos clientes do escritório.
    const r = (await db.execute(sql`
      UPDATE pedido_do_site SET status = 'PAGO', pago_em = now() WHERE id = ${id} AND status <> 'PAGO' RETURNING id
    `)) as unknown as { id: string }[];
    return r.length > 0;
  }
  if (tipo === 'fatura' && id) {
    const [f] = (await db.execute(sql`
      UPDATE accounting_invoice SET status = 'PAID', paid_at = now(),
             paid_with = ${cartao ? 'CARTAO' : p.billingType === 'PIX' ? 'PIX' : 'BOLETO'}
       WHERE id = ${id} AND status <> 'PAID'
       RETURNING asaas_payment_id, asaas_card_payment_id
    `)) as unknown as { asaas_payment_id: string | null; asaas_card_payment_id: string | null }[];
    const outra = f ? (cartao ? f.asaas_payment_id : f.asaas_card_payment_id) : null;
    if (outra) await asaas(c, 'DELETE', `/payments/${outra}`).catch(() => null);
    return !!f;
  }
  if (tipo === 'anual' && id) {
    const [s] = (await db.execute(sql`
      UPDATE subscription
         SET billing_cycle = 'ANUAL',
             paid_until = (date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo') + interval '12 months' - interval '1 day')::date
       WHERE id = ${id} AND (paid_until IS NULL OR paid_until < now()::date)
       RETURNING company_id::text
    `)) as unknown as { company_id: string }[];
    if (!s) return false;
    const abertas = (await db.execute(sql`
      UPDATE accounting_invoice SET status = 'PAID', paid_at = now(), paid_with = 'ANUAL'
       WHERE company_id = ${s.company_id} AND status <> 'PAID'
         AND reference_month >= date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date
       RETURNING asaas_payment_id
    `)) as unknown as { asaas_payment_id: string | null }[];
    for (const a of abertas) if (a.asaas_payment_id) await asaas(c, 'DELETE', `/payments/${a.asaas_payment_id}`).catch(() => null);
    return true;
  }
  return false;
}

/** Consulta direta das cobranças abertas da empresa — não depende só do webhook. */
export async function conferirPagamentosDaEmpresa(companyId: string): Promise<void> {
  const c = await conexaoAsaas();
  if (!c) return;
  const ids = (await getDb().execute(sql`
    SELECT unnest(ARRAY[asaas_payment_id, asaas_card_payment_id]) AS id FROM accounting_invoice
     WHERE company_id = ${companyId} AND status <> 'PAID'
    UNION
    SELECT asaas_annual_payment_id FROM subscription WHERE company_id = ${companyId} AND asaas_annual_payment_id IS NOT NULL
      AND (paid_until IS NULL OR paid_until < now()::date)
  `)) as unknown as { id: string | null }[];
  for (const { id } of ids) {
    if (!id) continue;
    const p = await asaas<Pagamento & { externalReference?: string }>(c, 'GET', `/payments/${id}`).catch(() => null);
    if (p) await aplicarPagamento(c, p);
  }
}
