import 'server-only';

/**
 * Consulta um CNPJ na Receita (CNPJá com chave; ReceitaWS de reserva) e
 * devolve o que o Hub usa para cadastrar a empresa. Compartilhado pelo
 * cadastro do cliente e pela área do contador.
 */
export async function lookupCnpj(doc: string) {
  const key = process.env.CNPJA_API_KEY;
  if (key) {
    const res = await fetch(`https://api.cnpja.com/${doc}?simples=true`, {
      headers: { Authorization: key },
      cache: 'no-store',
    });
    if (res.ok) {
      const d = await res.json();
      const addr = d.address ?? {};
      const phone = d.phones?.[0];
      return {
        razaoSocial: (d.company?.name as string) ?? '',
        nomeFantasia: (d.alias as string) ?? null,
        logradouro: (addr.street as string) ?? null,
        numero: (addr.number as string) ?? null,
        complemento: (addr.details as string) ?? null,
        bairro: (addr.district as string) ?? null,
        municipio: (addr.city as string) ?? null,
        codigoMunicipioIbge: addr.municipality ? String(addr.municipality) : null,
        uf: (addr.state as string) ?? null,
        cep: addr.zip ? String(addr.zip).padStart(8, '0') : null,
        telefone: phone ? `${phone.area}${phone.number}`.replace(/\D/g, '') : null,
        email: (d.emails?.[0]?.address as string) ?? null,
        cnae: d.mainActivity?.id ? String(d.mainActivity.id) : null,
        optanteSimples: Boolean(d.company?.simples?.optant),
        // A ficha da empresa (ver 0069). Vem de graça na mesma consulta.
        capitalSocial: typeof d.company?.equity === 'number' ? d.company.equity : null,
        abertura: (d.founded as string) ?? null,
        atividade: d.mainActivity?.text ? String(d.mainActivity.text) : null,
      };
    }
  }
  const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${doc}`, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const d = await res.json();
  if (d.status === 'ERROR') return null;
  return {
    razaoSocial: (d.nome as string) ?? '',
    nomeFantasia: (d.fantasia as string) || null,
    logradouro: (d.logradouro as string) ?? null,
    numero: (d.numero as string) ?? null,
    complemento: (d.complemento as string) || null,
    bairro: (d.bairro as string) ?? null,
    municipio: (d.municipio as string) ?? null,
    codigoMunicipioIbge: null, // ReceitaWS não retorna o código IBGE
    uf: (d.uf as string) ?? null,
    cep: d.cep ? String(d.cep).replace(/\D/g, '') : null,
    telefone: d.telefone ? String(d.telefone).replace(/\D/g, '') : null,
    email: (d.email as string) || null,
    cnae: d.atividade_principal?.[0]?.code ? String(d.atividade_principal[0].code).replace(/\D/g, '') : null,
    optanteSimples: false,
    capitalSocial: d.capital_social ? Number(d.capital_social) : null,
    // A ReceitaWS devolve DD/MM/AAAA; o banco quer ISO.
    abertura: typeof d.abertura === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(d.abertura)
      ? d.abertura.split('/').reverse().join('-')
      : null,
    atividade: d.atividade_principal?.[0]?.text ? String(d.atividade_principal[0].text) : null,
  };
}

export type DadosDaReceita = NonNullable<Awaited<ReturnType<typeof lookupCnpj>>>;

/** Os campos de `company` que vêm da Receita. */
export function camposDaEmpresa(data: DadosDaReceita, cnpjFormatado: string) {
  return {
    legalName: data.razaoSocial,
    tradeName: data.nomeFantasia,
    cnpj: cnpjFormatado,
    addressLine1: [data.logradouro, data.complemento].filter(Boolean).join(', ') || null,
    addressNumber: data.numero,
    neighborhood: data.bairro,
    city: data.municipio,
    state: data.uf,
    zipcode: data.cep,
    // A ficha que o empresário reconhece como "minha empresa" — ver 0069.
    shareCapital: data.capitalSocial === null ? null : String(data.capitalSocial),
    foundedAt: data.abertura,
    mainActivityCode: data.cnae,
    mainActivityText: data.atividade,
  };
}

/** O cadastro fiscal (base da emissão de NFS-e) que a Receita já preenche. */
export function baseFiscal(data: DadosDaReceita, doc: string) {
  return {
    cnpj: doc,
    razaoSocial: data.razaoSocial,
    nomeFantasia: data.nomeFantasia,
    cep: data.cep,
    logradouro: data.logradouro,
    numero: data.numero,
    complemento: data.complemento,
    bairro: data.bairro,
    uf: data.uf,
    codigoMunicipio: data.codigoMunicipioIbge,
    telefone: data.telefone,
    emailContato: data.email,
    cnae: data.cnae,
    optanteSimples: data.optanteSimples,
  };
}
