import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';

/**
 * CONTA BANCÁRIA — reconhecida pelo extrato, não digitada.
 *
 * ── Por que existe ──────────────────────────────────────────────────────
 *
 * Nada no sistema criava conta bancária, a não ser um botão de "dados de
 * teste" na tela do cliente — que criava uma conta chamada "Banco Mock" e
 * três transações inventadas na empresa real. Removido o botão, a tela de
 * importar extrato dizia "cadastre uma conta antes" sem ter onde.
 *
 * O OFX já diz de que banco e de que conta ele é (`BANKID`, `ACCTID`).
 * Pedir que alguém digite isso é pedir uma segunda versão, com erro de
 * digitação, do que o arquivo já traz exato.
 */

/** Código de compensação → nome como o cliente conhece o banco. */
const BANCOS: Record<string, string> = {
  '001': 'Banco do Brasil', '033': 'Santander', '077': 'Inter', '104': 'Caixa',
  '197': 'Stone', '208': 'BTG Pactual', '212': 'Banco Original', '237': 'Bradesco',
  '260': 'Nubank', '290': 'PagBank', '323': 'Mercado Pago', '336': 'C6 Bank',
  '341': 'Itaú', '380': 'PicPay', '403': 'Cora', '422': 'Safra', '655': 'Neon',
  '748': 'Sicredi', '756': 'Sicoob',
};

export function nomeDoBanco(codigo: string | null): string | null {
  if (!codigo) return null;
  const c = codigo.replace(/\D/g, '').padStart(3, '0').slice(-3);
  return BANCOS[c] ?? `Banco ${c}`;
}

/** Só dígitos, sem zeros à esquerda: "0001234-5" e "12345" são a mesma conta. */
export function numeroNormalizado(numero: string | null | undefined): string {
  return String(numero ?? '').replace(/\D/g, '').replace(/^0+/, '');
}

export interface ContaDoExtrato {
  id: string;
  nome: string;
  criada: boolean;
}

/**
 * A conta de um extrato: a escolhida, a reconhecida, ou uma nova.
 *
 * Com conta ESCOLHIDA e um OFX que diz ser de outra, recusa. Importar o
 * extrato de uma conta na outra deixa as duas erradas — os saldos não batem,
 * a conciliação casa pagamento com a conta que não pagou — e nada acusa,
 * porque cada movimento, sozinho, parece legítimo.
 */
export async function contaDoExtrato(
  tx: DbHandle,
  companyId: string,
  escolhida: string | null,
  doArquivo: { banco: string | null; conta: string | null },
): Promise<ContaDoExtrato> {
  const numeroArquivo = numeroNormalizado(doArquivo.conta);

  const contas = (await tx.execute(sql`
    SELECT id::text, bank_name, number FROM bank_account WHERE company_id = ${companyId}
  `)) as unknown as { id: string; bank_name: string; number: string | null }[];

  if (escolhida) {
    const c = contas.find((x) => x.id === escolhida);
    if (!c) throw new Error('A conta escolhida não é desta empresa.');
    const numeroEscolhida = numeroNormalizado(c.number);
    if (numeroArquivo && numeroEscolhida && numeroArquivo !== numeroEscolhida) {
      throw new Error(
        `Este extrato é da conta ${doArquivo.conta}${doArquivo.banco ? ` (${nomeDoBanco(doArquivo.banco)})` : ''}, ` +
          `não da ${c.bank_name} · ${c.number}. Escolha a conta certa, ou deixe em ` +
          '"reconhecer pelo arquivo".',
      );
    }
    return { id: c.id, nome: c.bank_name, criada: false };
  }

  if (!numeroArquivo) {
    throw new Error(
      'Este arquivo não diz de que conta é (CSV não traz essa informação). ' +
        'Escolha a conta na lista, ou cadastre-a antes de importar.',
    );
  }

  const ja = contas.find((x) => numeroNormalizado(x.number) === numeroArquivo);
  if (ja) return { id: ja.id, nome: ja.bank_name, criada: false };

  const nome = nomeDoBanco(doArquivo.banco) ?? 'Conta bancária';
  const [nova] = (await tx.execute(sql`
    INSERT INTO bank_account (company_id, bank_name, number)
    VALUES (${companyId}, ${nome}, ${doArquivo.conta})
    RETURNING id::text
  `)) as unknown as { id: string }[];
  return { id: nova!.id, nome, criada: true };
}

/** Cadastro manual — para quem só tem CSV. */
export async function criarContaBancaria(
  tx: DbHandle,
  companyId: string,
  banco: string,
  numero: string,
): Promise<{ id: string }> {
  const nome = banco.trim();
  const num = numero.trim();
  if (nome.length < 2) throw new Error('Informe o banco.');
  if (!numeroNormalizado(num)) throw new Error('Informe o número da conta.');

  const [ja] = (await tx.execute(sql`
    SELECT id::text FROM bank_account
     WHERE company_id = ${companyId}
       AND ltrim(regexp_replace(COALESCE(number, ''), '\\D', '', 'g'), '0') = ${numeroNormalizado(num)}
  `)) as unknown as { id: string }[];
  if (ja) return ja;

  const [nova] = (await tx.execute(sql`
    INSERT INTO bank_account (company_id, bank_name, number) VALUES (${companyId}, ${nome}, ${num})
    RETURNING id::text
  `)) as unknown as { id: string }[];
  return nova!;
}
