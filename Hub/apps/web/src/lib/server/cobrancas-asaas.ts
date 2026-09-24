import 'server-only';
import { getDb, withDbTimeout, sql } from '@hexxa/db';

/**
 * A COBRANÇA QUE SE BAIXA SOZINHA.
 *
 * O Pix gerado para uma conta a receber nasce na conta Asaas do próprio
 * cliente, e o aviso de pagamento que o Asaas manda (webhook) só é aceito com
 * o token da conta da plataforma — então a baixa nunca acontecia. Em vez de
 * depender do aviso, esta rotina pergunta: para cada empresa com Asaas ligado,
 * consulta as cobranças em aberto com a chave dela e marca como recebido o
 * que foi pago. Idempotente: rodar de novo não muda o que já foi baixado.
 */

const PAGO = new Set(['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH']);

export interface ResultadoDaConferencia {
  empresas: number;
  conferidas: number;
  baixadas: number;
  erros: string[];
}

export async function conferirCobrancasAsaas(limiteMs = 240_000): Promise<ResultadoDaConferencia> {
  const inicio = Date.now();
  const db = getDb();
  const out: ResultadoDaConferencia = { empresas: 0, conferidas: 0, baixadas: 0, erros: [] };

  const credenciais = (await withDbTimeout(
    db.execute(sql`
      SELECT ic.company_id, ic.secret_ref
        FROM integration_credential ic
        JOIN company c ON c.id = ic.company_id AND c.closed_at IS NULL
       WHERE ic.provider = 'asaas' AND ic.active
    `),
    8000,
  )) as unknown as { company_id: string; secret_ref: { access_token?: string } | null }[];

  for (const cred of credenciais) {
    const chave = cred.secret_ref?.access_token;
    if (!chave) continue;
    out.empresas++;
    const base = chave.includes('sandbox') ? 'https://sandbox.asaas.com/api/v3' : 'https://api.asaas.com/v3';

    // Só lançamentos a receber em aberto que nasceram de uma cobrança Asaas
    // (o id da cobrança fica em external_id e começa com "pay_").
    const abertos = (await db.execute(sql`
      SELECT id, external_id FROM financial_entry
       WHERE company_id = ${cred.company_id}
         AND type = 'RECEIVABLE'
         AND status IN ('PENDING', 'OVERDUE')
         AND external_id LIKE 'pay\\_%'
    `)) as unknown as { id: string; external_id: string }[];

    for (const l of abertos) {
      if (Date.now() - inicio > limiteMs) return out;
      out.conferidas++;
      try {
        const res = await fetch(`${base}/payments/${l.external_id}`, {
          headers: { access_token: chave, 'Content-Type': 'application/json' },
          cache: 'no-store',
        });
        if (!res.ok) continue;
        const p = (await res.json()) as { status?: string; paymentDate?: string; clientPaymentDate?: string };
        if (!p.status || !PAGO.has(p.status)) continue;
        const pagoEm = (p.clientPaymentDate ?? p.paymentDate ?? new Date().toISOString()).slice(0, 10);
        await db.execute(sql`
          UPDATE financial_entry SET status = 'PAID', paid_at = ${pagoEm}
           WHERE id = ${l.id} AND status <> 'PAID'
        `);
        out.baixadas++;
      } catch (err) {
        out.erros.push(`${l.external_id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  return out;
}
