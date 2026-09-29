import 'server-only';

/**
 * CONSULTA DE CNPJ — a base pública da Receita, pela BrasilAPI.
 *
 * Digitou o CNPJ do cliente, vêm razão social, endereço e o código IBGE do
 * município — tudo que a nota pede do tomador, sem ninguém digitar. Só o CNPJ
 * sai daqui; nenhum outro dado da empresa é enviado.
 */

export interface EnderecoDaNota {
  cep: string;
  cMun: string; // código IBGE, 7 dígitos
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  municipio: string;
  uf: string;
}

export interface DadosDoCnpj {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  telefone: string | null;
  situacao: string | null;
  endereco: EnderecoDaNota | null;
  /** CNAE principal e secundários, como a Receita registra. */
  atividades: { codigo: string; descricao: string; principal: boolean }[];
}

/** Dígitos verificadores de CPF ou CNPJ — a primeira trava antes de mandar ao governo. */
export function documentoValido(doc: string): boolean {
  const d = doc.replace(/\D/g, '');
  if (d.length === 11) {
    if (/^(\d)\1{10}$/.test(d)) return false;
    const dv = (n: number) => {
      let s = 0;
      for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
  }
  if (d.length === 14) {
    if (/^(\d)\1{13}$/.test(d)) return false;
    const dv = (n: number) => {
      const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
      const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0);
      const r = s % 11;
      return r < 2 ? 0 : 11 - r;
    };
    return dv(12) === Number(d[12]) && dv(13) === Number(d[13]);
  }
  return false;
}

export async function consultarCnpj(cnpj: string): Promise<DadosDoCnpj | null> {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14 || !documentoValido(d)) return null;
  try {
    // Sem User-Agent a BrasilAPI (atrás do Cloudflare) responde 403 para o fetch do Node.
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`, {
      headers: { 'User-Agent': 'HexxGestaoDigital/1.0', Accept: 'application/json' },
      next: { revalidate: 60 * 60 * 24 * 7 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as Record<string, unknown>;
    const t = (k: string) => (j[k] == null ? '' : String(j[k]).trim());
    const logradouro = [t('descricao_tipo_de_logradouro'), t('logradouro')].filter(Boolean).join(' ');
    const cMun = t('codigo_municipio_ibge');
    return {
      cnpj: d,
      razaoSocial: t('razao_social'),
      nomeFantasia: t('nome_fantasia') || null,
      email: t('email') || null,
      telefone: t('ddd_telefone_1') || null,
      situacao: t('descricao_situacao_cadastral') || null,
      atividades: [
        ...(t('cnae_fiscal') ? [{ codigo: t('cnae_fiscal'), descricao: t('cnae_fiscal_descricao'), principal: true }] : []),
        ...(Array.isArray(j.cnaes_secundarios) ? (j.cnaes_secundarios as { codigo?: unknown; descricao?: unknown }[]) : [])
          .filter((c) => c.codigo && Number(c.codigo) > 0)
          .map((c) => ({ codigo: String(c.codigo), descricao: String(c.descricao ?? ''), principal: false })),
      ],
      endereco:
        cMun.length === 7 && t('cep')
          ? {
              cep: t('cep').replace(/\D/g, ''),
              cMun,
              logradouro: logradouro || 'Não informado',
              numero: t('numero') || 'S/N',
              complemento: t('complemento') || undefined,
              bairro: t('bairro') || 'Não informado',
              municipio: t('municipio'),
              uf: t('uf'),
            }
          : null,
    };
  } catch {
    return null;
  }
}

/** Uma linha legível do endereço, para o campo `address` (texto livre) do cliente. */
export function enderecoEmTexto(e: EnderecoDaNota): string {
  return `${e.logradouro}, ${e.numero}${e.complemento ? ` ${e.complemento}` : ''} — ${e.bairro}, ${e.municipio}/${e.uf} — CEP ${e.cep}`;
}

/**
 * Completa o endereço da empresa pelo cartão do CNPJ quando o cadastro está
 * sem rua — empresa criada fora do cadastro normal (a própria HEXX estava
 * assim). Só preenche o que está vazio; nunca sobrescreve o que alguém digitou.
 */
export async function completarEnderecoPeloCnpj(companyId: string): Promise<boolean> {
  const { getDb, sql } = await import('@hexxa/db');
  const db = getDb();
  const [c] = (await db.execute(sql`SELECT cnpj, address_line1 FROM company WHERE id = ${companyId}`)) as unknown as { cnpj: string | null; address_line1: string | null }[];
  if (!c?.cnpj || c.address_line1) return false;
  const dados = await consultarCnpj(c.cnpj);
  const e = dados?.endereco;
  if (!e) return false;
  await db.execute(sql`
    UPDATE company SET
      address_line1 = COALESCE(address_line1, ${e.logradouro}),
      address_number = COALESCE(address_number, ${e.complemento ? `${e.numero}, ${e.complemento}` : e.numero}),
      neighborhood = COALESCE(neighborhood, ${e.bairro}),
      city = COALESCE(city, ${e.municipio}),
      state = COALESCE(state, ${e.uf}),
      zipcode = COALESCE(zipcode, ${e.cep})
    WHERE id = ${companyId}
  `);
  return true;
}

/**
 * CNAE principal de um CNPJ, com cache compartilhado (`cnae_do_cnpj`): o
 * mesmo fornecedor aparece em muitos extratos e muitos clientes. Consulta
 * falha (fora do ar, CNPJ inválido) não é gravada — tenta de novo depois.
 */
export async function cnaeDoCnpj(cnpj: string): Promise<{ cnae: string; descricao: string } | null> {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return null;
  const { getDb, sql } = await import('@hexxa/db');
  const db = getDb();
  const [ja] = (await db.execute(sql`SELECT cnae, descricao FROM cnae_do_cnpj WHERE cnpj = ${d}`)) as unknown as { cnae: string | null; descricao: string | null }[];
  if (ja) return ja.cnae ? { cnae: ja.cnae, descricao: ja.descricao ?? '' } : null;
  const dados = await consultarCnpj(d);
  if (!dados) return null;
  const principal = dados.atividades.find((a) => a.principal);
  await db.execute(sql`
    INSERT INTO cnae_do_cnpj (cnpj, cnae, descricao, razao_social)
    VALUES (${d}, ${principal?.codigo ?? null}, ${principal?.descricao ?? null}, ${dados.razaoSocial})
    ON CONFLICT (cnpj) DO NOTHING
  `);
  return principal ? { cnae: principal.codigo, descricao: principal.descricao } : null;
}
