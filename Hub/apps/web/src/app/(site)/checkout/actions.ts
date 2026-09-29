'use server';

import { headers } from 'next/headers';
import { getDb, sql } from '@hexxa/db';
import { cpfValido, cnpjValido, normalizeDocument } from '@hexxa/core/document-br';
import { PLANOS, valorMensal, type Cobranca, type MetodoPagamento, type PlanoId } from '@/lib/site/planos';
import { VERSAO_CONTRATO, VERSAO_TERMOS } from '@/lib/contratos/textos';
import { cobrancaDoPedido } from '@/lib/server/asaas-plataforma';

/** Plano do site → linha da tabela `plan` do Hub. */
const PLANO_DO_HUB: Record<PlanoId, string> = {
  mei: 'MEI',
  'sem-movimento': 'Sem movimento',
  'simples-light': 'Simples Light',
  'simples-completo': 'Com movimento',
  presumido: 'Lucro Presumido',
};

export type DadosDoPedido = {
  plano: PlanoId;
  cobranca: Cobranca;
  metodo: MetodoPagamento;
  temCnpj: boolean;
  cnpj: string;
  razao: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  aceite: boolean;
};

export type ResultadoDoPedido =
  | { ok: false; erro: string }
  | {
      ok: true;
      /** Cartão: a página segura do Asaas, para onde o navegador vai. */
      paginaDoCartao?: string;
      pix?: { copiaECola: string; imagem: string | null };
      boletoUrl?: string;
      /** Sem cobrança automática (Asaas indisponível): o time envia o link. */
      semCobranca?: boolean;
    };

// Limite simples por IP: o checkout cria cliente e cobrança no Asaas.
const tentativas = new Map<string, number[]>();
function muitasTentativas(ip: string) {
  const agora = Date.now();
  const lista = (tentativas.get(ip) ?? []).filter((t) => agora - t < 10 * 60_000);
  lista.push(agora);
  tentativas.set(ip, lista);
  return lista.length > 8;
}

export async function contratarAction(d: DadosDoPedido): Promise<ResultadoDoPedido> {
  const p = PLANOS[d.plano];
  if (!p) return { ok: false, erro: 'Plano não encontrado.' };
  if (d.cobranca !== 'anual' && d.cobranca !== 'mensal') return { ok: false, erro: 'Escolha a forma de cobrança.' };
  // Anual é só no cartão (12×); mês a mês aceita os três.
  if (d.cobranca === 'anual' && d.metodo !== 'cartao') return { ok: false, erro: 'O anual é pago em 12× no cartão.' };
  if (!['pix', 'boleto', 'cartao'].includes(d.metodo)) return { ok: false, erro: 'Escolha a forma de pagamento.' };
  if (!d.aceite) return { ok: false, erro: 'É preciso aceitar os termos de uso e o contrato.' };

  const nome = d.nome.trim();
  const email = d.email.trim().toLowerCase();
  const telefone = d.telefone.replace(/\D/g, '');
  const cpf = normalizeDocument(d.cpf);
  const cnpj = d.temCnpj ? normalizeDocument(d.cnpj) : null;
  if (nome.split(/\s+/).length < 2) return { ok: false, erro: 'Informe o nome completo.' };
  if (!cpfValido(cpf)) return { ok: false, erro: 'Confira o CPF: os dígitos não batem.' };
  if (d.temCnpj && !cnpjValido(cnpj)) return { ok: false, erro: 'Confira o CNPJ: os dígitos não batem.' };
  if (d.temCnpj && d.razao.trim().length < 3) return { ok: false, erro: 'Informe a razão social.' };
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) return { ok: false, erro: 'Confira o e-mail.' };
  if (telefone.length < 10 || telefone.length > 11) return { ok: false, erro: 'Confira o WhatsApp com DDD.' };

  const h = await headers();
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0]!.trim() || 'desconhecido';
  if (muitasTentativas(ip)) return { ok: false, erro: 'Muitas tentativas seguidas. Espere alguns minutos ou fale com a gente no WhatsApp.' };

  const valor = valorMensal(p, d.cobranca, d.metodo);
  const parcelas = d.cobranca === 'anual' ? 12 : 1;

  const [pedido] = (await getDb().execute(sql`
    INSERT INTO pedido_do_site (plano, plan_id, cobranca, metodo, tem_cnpj, cnpj, razao_social, nome, cpf, email, telefone,
                                valor, parcelas, aceite_versao, aceite_ip)
    VALUES (${d.plano}, (SELECT id FROM plan WHERE name = ${PLANO_DO_HUB[d.plano]} LIMIT 1), ${d.cobranca}, ${d.metodo},
            ${d.temCnpj}, ${cnpj}, ${d.temCnpj ? d.razao.trim() : null}, ${nome}, ${cpf}, ${email}, ${telefone},
            ${valor}, ${parcelas}, ${`contrato ${VERSAO_CONTRATO} · termos ${VERSAO_TERMOS}`}, ${ip})
    RETURNING id::text
  `)) as unknown as { id: string }[];

  try {
    const c = await cobrancaDoPedido(pedido!.id);
    if (!c) {
      await getDb().execute(sql`UPDATE pedido_do_site SET status = 'SEM_COBRANCA' WHERE id = ${pedido!.id}`);
      return { ok: true, semCobranca: true };
    }
    return { ok: true, ...c };
  } catch (e) {
    console.error('[checkout] Asaas recusou a cobrança', pedido!.id, e);
    await getDb().execute(sql`UPDATE pedido_do_site SET status = 'SEM_COBRANCA' WHERE id = ${pedido!.id}`);
    return { ok: true, semCobranca: true };
  }
}
