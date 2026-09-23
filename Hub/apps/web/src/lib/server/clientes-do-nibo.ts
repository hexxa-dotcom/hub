import 'server-only';
import { getDb, withDbTimeout, sql, company } from '@hexxa/db';
import { formatDocument } from '@hexxa/core/document-br';
import { saveNfseConfig } from './fiscal';
import { lookupCnpj, camposDaEmpresa, baseFiscal } from './receita';

/**
 * OS CLIENTES DO ESCRITÓRIO, VINDOS DO NIBO.
 *
 * A sincronização do Nibo grava a carteira da HEXX como clientes DELA (a
 * tabela `customer`, de quem a HEXX fatura). Cada um desses é uma empresa que
 * pode virar cliente do Hub — mas só quando o contador decidir. Por isso eles
 * aparecem aqui, na área do contador, e não como empresas: habilitar é o ato
 * que cria a empresa no Hub. Assim a lista de empresas só tem quem já foi
 * habilitado, e não a carteira inteira.
 */
const CNPJ_DO_ESCRITORIO = '62.414.421/0001-16';

export interface ClienteDoNibo {
  document: string;
  nome: string;
  email: string | null;
  /** A empresa no Hub, quando já habilitado. */
  companyId: string | null;
}

export async function listarClientesDoNibo(): Promise<ClienteDoNibo[]> {
  const linhas = (await withDbTimeout(
    getDb().execute(sql`
      SELECT DISTINCT ON (regexp_replace(cu.document, '[^0-9A-Za-z]', '', 'g'))
             regexp_replace(cu.document, '[^0-9A-Za-z]', '', 'g') AS document,
             cu.name AS nome,
             cu.email,
             c.id AS company_id
        FROM customer cu
        JOIN company escritorio ON escritorio.id = cu.company_id AND escritorio.cnpj = ${CNPJ_DO_ESCRITORIO}
        LEFT JOIN company c
               ON regexp_replace(c.cnpj, '[^0-9A-Za-z]', '', 'g') = regexp_replace(cu.document, '[^0-9A-Za-z]', '', 'g')
       -- Só CNPJ: pessoa física não vira empresa no Hub.
       WHERE length(regexp_replace(cu.document, '[^0-9A-Za-z]', '', 'g')) = 14
       ORDER BY regexp_replace(cu.document, '[^0-9A-Za-z]', '', 'g'), c.id NULLS LAST
    `),
    8000,
  )) as unknown as { document: string; nome: string; email: string | null; company_id: string | null }[];

  return linhas
    .map((l) => ({ document: l.document, nome: l.nome, email: l.email, companyId: l.company_id }))
    .sort((a, b) => Number(Boolean(a.companyId)) - Number(Boolean(b.companyId)) || a.nome.localeCompare(b.nome));
}

/**
 * Cria a empresa no Hub a partir do CNPJ, com os dados da Receita. Ninguém é
 * vinculado como dono: o contador entra por "Entrar na área do cliente", e o
 * dono é convidado quando for a hora. A aprovação (que leva ao OneFlow) segue
 * pelo caminho de sempre, na página do cliente.
 */
export async function habilitarClienteDoNibo(document: string): Promise<{ companyId: string; nome: string }> {
  const doc = document.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
  if (doc.length !== 14) throw new Error('Só dá para habilitar CNPJ.');
  const db = getDb();

  const [existente] = (await db.execute(sql`
    SELECT id, legal_name FROM company
     WHERE regexp_replace(cnpj, '[^0-9A-Za-z]', '', 'g') = ${doc} LIMIT 1
  `)) as unknown as { id: string; legal_name: string }[];
  if (existente) return { companyId: existente.id, nome: existente.legal_name };

  const data = await lookupCnpj(doc).catch(() => null);
  if (!data?.razaoSocial) throw new Error('A Receita não respondeu para este CNPJ. Tente de novo em instantes.');

  const [criada] = await withDbTimeout(
    db
      .insert(company)
      .values({ ...camposDaEmpresa(data, formatDocument(doc)), type: 'SERVICE' })
      .returning({ id: company.id }),
    8000,
  );
  await saveNfseConfig({ companyId: criada!.id, companyType: 'SERVICE', userId: 'contador' }, baseFiscal(data, doc));
  return { companyId: criada!.id, nome: data.razaoSocial };
}
