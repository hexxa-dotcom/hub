import { NextResponse } from 'next/server';

export type CepData = {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  /** Código IBGE do município (7 dígitos) — exigido no endereço do tomador da DPS/NFS-e. */
  codigoMunicipio: string;
};

/** Proxy pro ViaCEP — gratuito, sem chave. Devolve o código IBGE do município junto (campo `ibge`), que o CEP sozinho já resolve sem precisar de um seletor de cidade separado. */
export async function GET(_req: Request, { params }: { params: Promise<{ cep: string }> }) {
  const { cep } = await params;
  const doc = cep.replace(/\D/g, '');
  if (doc.length !== 8) {
    return NextResponse.json({ error: 'CEP inválido' }, { status: 400 });
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${doc}/json/`, { next: { revalidate: 86400 } });
    if (!res.ok) return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 });
    const d = await res.json();
    if (d.erro) return NextResponse.json({ error: 'CEP não encontrado' }, { status: 404 });

    const result: CepData = {
      cep: doc,
      logradouro: d.logradouro ?? '',
      bairro: d.bairro ?? '',
      cidade: d.localidade ?? '',
      uf: d.uf ?? '',
      codigoMunicipio: d.ibge ?? '',
    };
    return NextResponse.json(result);
  } catch (err) {
    console.error('CEP lookup error:', err);
    return NextResponse.json({ error: 'Falha na consulta do CEP' }, { status: 500 });
  }
}
