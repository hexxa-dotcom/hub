import { sql } from 'drizzle-orm';
import type { DbHandle } from '../client';

/**
 * Parceiro (cliente/fornecedor) pelo CPF/CNPJ.
 *
 * O documento é o que liga as três pontas: a nota (tomador), o extrato (quem
 * pagou) e o OneFlow (conta de Clientes/Fornecedores por participante). Sem
 * ele a baixa casa por valor com o cliente errado e o envio fica retido.
 */
export async function parceiroPeloDocumento(
  tx: DbHandle,
  companyId: string,
  p: { nome: string | null; documento: string | null; tipo: 'CLIENT' | 'SUPPLIER' },
): Promise<string | null> {
  const doc = (p.documento ?? '').replace(/\D/g, '');
  if (doc.length !== 11 && doc.length !== 14) return null;
  const [ja] = (await tx.execute(sql`
    SELECT id::text FROM business_partner
     WHERE company_id = ${companyId}
       AND regexp_replace(coalesce(document, ''), '[^0-9]', '', 'g') = ${doc}
     LIMIT 1
  `)) as unknown as { id: string }[];
  if (ja) return ja.id;
  const [novo] = (await tx.execute(sql`
    INSERT INTO business_partner (company_id, name, document, type)
    VALUES (${companyId}, ${(p.nome ?? '').trim() || doc}, ${doc}, ${p.tipo})
    RETURNING id::text
  `)) as unknown as { id: string }[];
  return novo!.id;
}

/**
 * O dinheiro saiu para um SÓCIO da empresa? Pelo nome completo no histórico ou
 * pelos dígitos do CPF que o banco deixa à mostra ("•••.844.058-••").
 *
 * Regra do escritório (Filipe, 28/09/2026): transferência para sócio é
 * distribuição de lucros, ponto final — não se pergunta. Pró-labore sai pela
 * folha e é baixado contra ela antes de chegar aqui.
 */
export async function saidaParaSocio(tx: DbHandle, companyId: string, descricao: string, valor: number): Promise<boolean> {
  if (valor >= 0) return false;
  const socios = (await tx.execute(sql`
    SELECT name, cpf FROM partner WHERE company_id = ${companyId}
  `)) as unknown as { name: string; cpf: string | null }[];
  if (!socios.length) return false;
  const palavras = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
  const noHistorico = palavras(descricao);
  // CPF mascarado: o banco mostra os 6 dígitos do meio (posições 4–9).
  const meioDoCpf = descricao.match(/\.(\d{3})\.(\d{3})-/);
  return socios.some((s) => {
    const nome = palavras(s.name);
    if (nome.length >= 2 && nome.every((w) => noHistorico.includes(w))) return true;
    const cpf = (s.cpf ?? '').replace(/\D/g, '');
    return !!meioDoCpf && cpf.length === 11 && cpf.slice(3, 9) === meioDoCpf[1]! + meioDoCpf[2]!;
  });
}

/**
 * CNPJ de quem pagou ou recebeu, lido do histórico do extrato.
 *
 * Os bancos escrevem com espaços e pontuação soltos ("26.994.854 /0001-24",
 * "62.414.421/0001- 16"). CPF vem mascarado ("•••.713.758-••") e não serve
 * para identificar ninguém — só CNPJ completo conta.
 */
export function cnpjNoHistorico(descricao: string): string | null {
  const m = descricao.match(/(\d{2})\s*\.\s*(\d{3})\s*\.\s*(\d{3})\s*\/\s*(\d{4})\s*-\s*(\d{2})/);
  return m ? m.slice(1).join('') : null;
}
