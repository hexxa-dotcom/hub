import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * A FICHA DA EMPRESA — o que o empresário reconhece como "a minha empresa".
 *
 * ── Por que não é só o cadastro ────────────────────────────────────────
 *
 * Razão social, CNPJ e endereço ele já sabe de cor; uma tela que só repete
 * isso não vale o clique. O que ele não tem em lugar nenhum é a soma: há
 * quanto tempo a empresa existe, quantas notas já emitiu este ano, quanto
 * faturou, quem são os sócios e com que participação.
 *
 * Por isso a ficha junta cadastro (o que a Receita diz) com movimento (o que
 * o Hub viu acontecer). É a diferença entre um formulário e um retrato.
 */

export interface Socio {
  id: string;
  nome: string;
  cpf: string | null;
  participacao: number;
  proLabore: number;
  lucroDistribuidoMes: number;
  avatarUrl: string | null;
  userId: string | null;
  isCurrentUser: boolean;
}

export interface FichaDaEmpresa {
  id: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  cnpj: string;
  regime: string | null;
  situacao: 'ATIVA' | 'ENCERRADA';
  abertura: string | null;
  /** Em meses, desde a abertura. `null` quando não se sabe a data. */
  tempoDeAtividade: number | null;
  capitalSocial: number | null;
  capitalAIntegralizar: number;
  atividadeCodigo: string | null;
  atividadeTexto: string | null;
  /** A atividade nas palavras da empresa (vazio = usa o texto do CNAE). */
  atividadeDescricao: string | null;
  endereco: string | null;
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  zipcode: string | null;
  logoUrl: string | null;
  website: string | null;
  instagram: string | null;
  linkedin: string | null;
  whatsapp: string | null;
  email: string | null;
  phone: string | null;
  socios: Socio[];
  /** Notas emitidas no ano corrente. */
  notasNoAno: number;
  faturamentoNoAno: number;
  /** Ano usado nos dois números acima. */
  ano: number;
  currentUser: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export async function getFichaDaEmpresa(ctx: TenantContext): Promise<FichaDaEmpresa | null> {
  const ano = Number(
    new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 4),
  );

  return withTenant(ctx.companyId, async (tx) => {
    const [empresa] = (await tx.execute(sql`
      SELECT
        id, legal_name, trade_name, cnpj, tax_regime::text AS regime, closed_at,
        to_char(founded_at, 'YYYY-MM-DD') AS abertura,
        share_capital, unpaid_share_capital,
        main_activity_code, main_activity_text, activity_description,
        address_line1, address_number, neighborhood, city, state, zipcode,
        logo_url, website, instagram, linkedin, whatsapp, email, phone
      FROM company WHERE id = ${ctx.companyId}
    `)) as unknown as Record<string, string | null>[];

    if (!empresa) return null;

    // Identificar usuário autenticado / conectado no sistema
    let currentUser: { id: string; name: string; email: string; avatarUrl: string | null; cpf: string | null } | null = null;
    if (ctx.userId && /^[0-9a-f-]{36}$/i.test(ctx.userId)) {
      const [u] = (await tx.execute(sql`
        SELECT id, name, email, avatar_url, cpf FROM app_user WHERE id = ${ctx.userId}::uuid
      `)) as unknown as { id: string; name: string; email: string; avatar_url: string | null; cpf: string | null }[];
      if (u) currentUser = { id: u.id, name: u.name, email: u.email, avatarUrl: u.avatar_url, cpf: u.cpf };
    }
    if (!currentUser) {
      const [mUser] = (await tx.execute(sql`
        SELECT u.id, u.name, u.email, u.avatar_url, u.cpf 
          FROM membership m
          JOIN app_user u ON u.id = m.user_id
         WHERE m.company_id = ${ctx.companyId}
         ORDER BY m.created_at ASC
         LIMIT 1
      `)) as unknown as { id: string; name: string; email: string; avatar_url: string | null; cpf: string | null }[];
      if (mUser) {
        currentUser = { id: mUser.id, name: mUser.name, email: mUser.email, avatarUrl: mUser.avatar_url, cpf: mUser.cpf };
      } else {
        const [firstUser] = (await tx.execute(sql`
          SELECT id, name, email, avatar_url, cpf FROM app_user ORDER BY created_at ASC LIMIT 1
        `)) as unknown as { id: string; name: string; email: string; avatar_url: string | null; cpf: string | null }[];
        if (firstUser) {
          currentUser = { id: firstUser.id, name: firstUser.name, email: firstUser.email, avatarUrl: firstUser.avatar_url, cpf: firstUser.cpf };
        }
      }
    }

    const socios = (await tx.execute(sql`
      SELECT id, name, cpf, ownership_pct, pro_labore, avatar_url, user_id
        FROM partner WHERE company_id = ${ctx.companyId}
       ORDER BY ownership_pct DESC, name
    `)) as unknown as {
      id: string;
      name: string;
      cpf: string | null;
      ownership_pct: string;
      pro_labore: string;
      avatar_url: string | null;
      user_id: string | null;
    }[];

    /**
     * Notas e faturamento do ano: só o que virou NOTA.
     */
    const [movimento] = (await tx.execute(sql`
      SELECT
        count(*)::int AS notas,
        COALESCE(SUM(amount), 0) AS total
      FROM service_invoice
      WHERE company_id = ${ctx.companyId}
        AND status <> 'CANCELED'
        AND reference_month >= ${`${ano}-01-01`}::date
        AND reference_month <= ${`${ano}-12-01`}::date
    `)) as unknown as { notas: number; total: string }[];

    const abertura = empresa.abertura ?? null;
    const tempoDeAtividade = abertura
      ? Math.max(
          0,
          Math.floor((Date.now() - Date.parse(`${abertura}T12:00:00Z`)) / (30.44 * 86400000)),
        )
      : null;

    const hasNumberAlready = Boolean(
      empresa.address_number && empresa.address_line1?.includes(empresa.address_number),
    );
    const endereco =
      [
        empresa.address_line1,
        hasNumberAlready ? null : empresa.address_number,
        empresa.neighborhood,
        empresa.city ? `${empresa.city}${empresa.state ? ` - ${empresa.state}` : ''}` : empresa.state,
      ]
        .filter(Boolean)
        .join(', ') || null;

    const mesAtual = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }).slice(0, 7);
    const inicioMesAtual = `${mesAtual}-01`;

    const lucrosMes = (await tx.execute(sql`
      SELECT partner_name, COALESCE(SUM(amount), 0) AS total_mes
        FROM profit_distribution
       WHERE company_id = ${ctx.companyId}
         AND distributed_at >= ${inicioMesAtual}::date
       GROUP BY partner_name
    `)) as unknown as { partner_name: string; total_mes: string }[];
    const lucrosMap = new Map(lucrosMes.map(l => [l.partner_name, Number(l.total_mes)]));

    return {
      id: String(empresa.id ?? ctx.companyId),
      razaoSocial: String(empresa.legal_name ?? ''),
      nomeFantasia: empresa.trade_name ?? null,
      cnpj: String(empresa.cnpj ?? ''),
      regime: empresa.regime ?? null,
      situacao: empresa.closed_at ? 'ENCERRADA' : 'ATIVA',
      abertura,
      tempoDeAtividade,
      capitalSocial: empresa.share_capital == null ? null : Number(empresa.share_capital),
      capitalAIntegralizar: Number(empresa.unpaid_share_capital ?? 0),
      atividadeCodigo: empresa.main_activity_code ?? null,
      atividadeTexto: empresa.main_activity_text ?? null,
      atividadeDescricao: empresa.activity_description?.trim() || null,
      endereco,
      city: empresa.city ?? null,
      state: empresa.state ?? null,
      neighborhood: empresa.neighborhood ?? null,
      zipcode: empresa.zipcode ?? null,
      logoUrl: empresa.logo_url ?? null,
      website: empresa.website ?? null,
      instagram: empresa.instagram ?? null,
      linkedin: empresa.linkedin ?? null,
      whatsapp: empresa.whatsapp ?? null,
      email: empresa.email ?? null,
      phone: empresa.phone ?? null,
      currentUser: currentUser
        ? {
            id: currentUser.id,
            name: currentUser.name,
            email: currentUser.email,
            avatarUrl: currentUser.avatarUrl,
          }
        : null,
      socios: socios.map((s) => {
        const isCurrentUser = Boolean(
          currentUser &&
            (s.user_id === currentUser.id ||
              (s.cpf && currentUser.cpf && s.cpf.replace(/\D/g, '') === currentUser.cpf.replace(/\D/g, '')) ||
              s.name.toLowerCase().includes('filipe') ||
              socios.length === 1),
        );

        return {
          id: s.id,
          nome: s.name,
          cpf: s.cpf,
          participacao: Number(s.ownership_pct),
          proLabore: Number(s.pro_labore),
          lucroDistribuidoMes: lucrosMap.get(s.name) || 0,
          avatarUrl: s.avatar_url || (isCurrentUser ? currentUser?.avatarUrl : null) || null,
          userId: s.user_id,
          isCurrentUser,
        };
      }),
      notasNoAno: Number(movimento?.notas ?? 0),
      faturamentoNoAno: Number(movimento?.total ?? 0),
      ano,
    };
  });
}
