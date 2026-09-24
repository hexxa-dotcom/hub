import 'server-only';
import { getDb, sql } from '@hexxa/db';

/**
 * O ESCRITÓRIO — como o cliente fala com a contabilidade.
 *
 * Gravado pelo contador em Configurações (área do contador). Sem WhatsApp
 * cadastrado, o botão "Falar com Contador" leva ao Atendimento, dentro do
 * Hub, em vez de um número de exemplo.
 */

export interface Escritorio {
  nome: string;
  cnpj: string | null;
  email: string | null;
  /** Só dígitos, com DDI e DDD. */
  whatsapp: string | null;
  horario: string | null;
}

export async function dadosDoEscritorio(): Promise<Escritorio> {
  try {
    const [e] = (await getDb().execute(sql`SELECT nome, cnpj, email, whatsapp, horario FROM accounting_office WHERE id = 1`)) as unknown as Escritorio[];
    if (e) return { ...e, whatsapp: e.whatsapp && e.whatsapp.replace(/\D/g, '').length >= 12 ? e.whatsapp.replace(/\D/g, '') : null };
  } catch (err) {
    console.error('[escritorio] falha ao ler os dados do escritório:', err);
  }
  return { nome: '', cnpj: null, email: null, whatsapp: null, horario: null };
}

/** Link do WhatsApp do escritório com a mensagem pronta, ou null se não houver número. */
export function linkDoWhatsapp(whatsapp: string | null, mensagem = 'Olá! Preciso de ajuda com minha contabilidade.') {
  return whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(mensagem)}` : null;
}
