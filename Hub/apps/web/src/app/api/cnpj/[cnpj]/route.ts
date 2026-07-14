import { NextResponse } from 'next/server';

export type CnpjData = {
  razaoSocial: string;
  nomeFantasia: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  situacao: string;
  abertura: string | null;
};

const CNPJA_KEY = process.env.CNPJA_API_KEY;

async function fetchCnpja(digits: string, full = false) {
  const url = full
    ? `https://api.cnpja.com/${digits}?simples=true&sintegra=true`
    : `https://api.cnpja.com/${digits}`;

  const res = await fetch(url, {
    headers: { Authorization: CNPJA_KEY! },
    next: { revalidate: 3600 },
  });

  if (!res.ok) return null;
  return res.json();
}

async function fetchReceitaWS(digits: string) {
  const res = await fetch(`https://www.receitaws.com.br/v1/cnpj/${digits}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  const d = await res.json();
  if (d.status === 'ERROR') return null;
  return d;
}

export async function GET(req: Request, { params }: { params: Promise<{ cnpj: string }> }) {
  const { cnpj } = await params;
  const digits = cnpj.replace(/\D/g, '');
  const full = new URL(req.url).searchParams.get('full') === 'true';

  if (digits.length !== 14) {
    return NextResponse.json({ error: 'CNPJ inválido' }, { status: 400 });
  }

  try {
    if (CNPJA_KEY) {
      const d = await fetchCnpja(digits, full);

      if (d) {
        // Se full=true, retorna o objeto completo para a página de consulta.
        if (full) return NextResponse.json(d);

        // Versão resumida para auto-preenchimento do formulário de clientes.
        const phone = d.phones?.[0];
        const email = d.emails?.[0];
        const addr = d.address;
        const endereco = [addr?.street, addr?.number, addr?.details, addr?.district, addr?.city, addr?.state]
          .filter(Boolean).join(', ');

        const result: CnpjData = {
          razaoSocial: d.company?.name ?? '',
          nomeFantasia: d.alias ?? null,
          email: email?.address ?? null,
          telefone: phone ? `(${phone.area}) ${phone.number}` : null,
          endereco,
          bairro: addr?.district ?? null,
          cep: addr?.zip ? String(addr.zip).padStart(8, '0') : null,
          municipio: addr?.city ?? null,
          uf: addr?.state ?? null,
          situacao: d.status?.text ?? 'ATIVA',
          abertura: d.founded ?? null,
        };
        return NextResponse.json(result);
      }
    }

    // Fallback gratuito (sem chave ou cnpja falhou).
    const d = await fetchReceitaWS(digits);
    if (!d) return NextResponse.json({ error: 'CNPJ não encontrado' }, { status: 404 });

    if (full) {
      // Mapeia ReceitaWS para estrutura similar ao cnpja para a página de consulta.
      return NextResponse.json({
        taxId: digits,
        company: { name: d.nome, equity: null },
        alias: d.fantasia || null,
        founded: d.abertura || null,
        head: true,
        status: { text: d.situacao },
        address: {
          street: d.logradouro, number: d.numero, details: d.complemento || null,
          district: d.bairro, city: d.municipio, state: d.uf,
          zip: d.cep?.replace(/\D/g, ''),
        },
        phones: d.telefone ? [{ area: d.telefone.replace(/\D/g,'').slice(0,2), number: d.telefone }] : [],
        emails: d.email ? [{ address: d.email }] : [],
        mainActivity: d.atividade_principal?.[0]
          ? { id: d.atividade_principal[0].code, text: d.atividade_principal[0].text }
          : null,
        simples: null,
        sintegra: null,
      });
    }

    const result: CnpjData = {
      razaoSocial: d.nome ?? '',
      nomeFantasia: d.fantasia || null,
      email: d.email || null,
      telefone: d.telefone || null,
      endereco: [d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf].filter(Boolean).join(', '),
      bairro: d.bairro ?? null,
      cep: d.cep?.replace(/\D/g, '') ?? null,
      municipio: d.municipio ?? null,
      uf: d.uf ?? null,
      situacao: d.situacao ?? 'ATIVA',
      abertura: d.abertura ?? null,
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error('CNPJ lookup error:', err);
    return NextResponse.json({ error: 'Falha na consulta do CNPJ' }, { status: 500 });
  }
}
