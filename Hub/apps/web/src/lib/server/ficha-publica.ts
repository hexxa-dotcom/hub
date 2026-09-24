import { getDb, withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * A FICHA PÚBLICA — o cartão de visita da empresa, num link.
 *
 * É o que o empresário põe na bio do Instagram, no LinkedIn ou manda no
 * WhatsApp: quem é a empresa, o que faz, desde quando, e como falar com ela.
 *
 * Regra de ouro: só sai daqui o que já é público — o que o cartão CNPJ da
 * Receita mostra (nome, CNPJ, atividade, abertura, capital social, sede,
 * sócios) e os contatos que a própria empresa cadastrou para serem vistos.
 * Faturamento, pró-labore, CPF de sócio e endereço completo nunca entram.
 *
 * A leitura é sem tenant (quem abre o link não tem login), por isso a query
 * escolhe as colunas uma a uma e só responde quando o link está ligado.
 */

export interface FichaPublica {
  slug: string;
  nome: string;
  razaoSocial: string;
  cnpj: string;
  situacao: 'ATIVA' | 'ENCERRADA';
  abertura: string | null;
  capitalSocial: number | null;
  atividadeCodigo: string | null;
  /** Como a empresa descreve o que faz; sem descrição própria, o texto do CNAE. */
  atividadeTexto: string | null;
  /** Texto oficial do CNAE — só quando difere de `atividadeTexto`. */
  cnaeTexto: string | null;
  cidade: string | null;
  uf: string | null;
  logoUrl: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  whatsapp: string | null;
  email: string | null;
  telefone: string | null;
  socios: { nome: string; avatarUrl: string | null }[];
}

export async function getFichaPublica(slug: string): Promise<FichaPublica | null> {
  if (!/^[a-z0-9-]{2,60}$/.test(slug)) return null;
  const db = getDb();
  const [e] = (await db.execute(sql`
    SELECT id, ficha_publica_slug AS slug, legal_name, trade_name, cnpj, closed_at,
           to_char(founded_at, 'YYYY-MM-DD') AS abertura, share_capital,
           main_activity_code, main_activity_text, nullif(trim(activity_description), '') AS descricao, city, state,
           logo_url, website, instagram, linkedin, whatsapp, email, phone
      FROM company
     WHERE ficha_publica_slug = ${slug} AND ficha_publica_ativa
  `)) as unknown as Record<string, string | null>[];
  if (!e) return null;
  const v = (k: string) => e[k] ?? null;

  const socios = (await db.execute(sql`
    SELECT name, avatar_url FROM partner
     WHERE company_id = ${e.id}::uuid
     ORDER BY ownership_pct DESC, name
  `)) as unknown as { name: string; avatar_url: string | null }[];

  return {
    slug: e.slug!,
    nome: (e.trade_name || e.legal_name!).trim(),
    razaoSocial: e.legal_name!.trim(),
    cnpj: e.cnpj!,
    situacao: e.closed_at ? 'ENCERRADA' : 'ATIVA',
    abertura: v('abertura'),
    capitalSocial: e.share_capital ? Number(e.share_capital) : null,
    atividadeCodigo: v('main_activity_code'),
    atividadeTexto: v('descricao') ?? v('main_activity_text'),
    cnaeTexto: v('descricao') ? v('main_activity_text') : null,
    cidade: v('city'),
    uf: v('state'),
    logoUrl: v('logo_url'),
    website: v('website'),
    instagram: v('instagram'),
    linkedin: v('linkedin'),
    whatsapp: v('whatsapp'),
    email: v('email'),
    telefone: v('phone'),
    socios: socios.map((s) => ({ nome: s.name, avatarUrl: s.avatar_url })),
  };
}

export async function getLinkDaFicha(ctx: TenantContext): Promise<{ slug: string | null; ativa: boolean }> {
  return withTenant(ctx.companyId, async (tx) => {
    const [r] = (await tx.execute(sql`
      SELECT ficha_publica_slug AS slug, ficha_publica_ativa AS ativa FROM company WHERE id = ${ctx.companyId}
    `)) as unknown as { slug: string | null; ativa: boolean }[];
    return { slug: r?.slug ?? null, ativa: Boolean(r?.ativa) };
  });
}

/** "SIMED PREV - Gestão em Saúde" → "simed-prev-gestao-em-saude" (até 40 letras). */
export function slugDoNome(nome: string): string {
  return (
    nome
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\b(ltda|me|epp|eireli|s\/?a|slu)\b/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/, '') || 'empresa'
  );
}

/**
 * Liga (ou desliga) o link. Na primeira vez escolhe o endereço a partir do
 * nome fantasia; se já existir outra empresa com ele, acrescenta um número.
 * O endereço, uma vez escolhido, não muda — quem já colou na bio não perde.
 */
export async function definirFichaPublica(ctx: TenantContext, ativa: boolean): Promise<{ slug: string | null; ativa: boolean }> {
  const atual = await getLinkDaFicha(ctx);
  let slug = atual.slug;
  if (ativa && !slug) {
    const db = getDb();
    const [e] = (await db.execute(sql`
      SELECT coalesce(nullif(trade_name, ''), legal_name) AS nome FROM company WHERE id = ${ctx.companyId}::uuid
    `)) as unknown as { nome: string }[];
    const base = slugDoNome(e?.nome ?? 'empresa');
    for (let n = 1; n < 100 && !slug; n++) {
      const candidato = n === 1 ? base : `${base}-${n}`;
      const [ocupado] = (await db.execute(sql`
        SELECT 1 FROM company WHERE ficha_publica_slug = ${candidato}
      `)) as unknown as unknown[];
      if (!ocupado) slug = candidato;
    }
  }
  return withTenant(ctx.companyId, async (tx) => {
    await tx.execute(sql`
      UPDATE company SET ficha_publica_slug = ${slug}, ficha_publica_ativa = ${ativa} WHERE id = ${ctx.companyId}
    `);
    return { slug, ativa };
  });
}

/** Endereço completo do link, no domínio por onde a pessoa está usando o Hub. */
export async function urlDaFicha(slug: string): Promise<string> {
  const { headers } = await import('next/headers');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'hexx-hub.vercel.app';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}/e/${slug}`;
}

/** QR code do link, em SVG, para o cartão e para baixar e imprimir. */
export async function qrDaFicha(url: string): Promise<string> {
  const QR = await import('qrcode');
  return QR.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#0C110E', light: '#FFFFFF' } });
}
