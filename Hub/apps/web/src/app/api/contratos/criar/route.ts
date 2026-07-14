import { NextResponse } from 'next/server';
import { createDocument, type Signer } from '@/lib/autentique';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const name = String(form.get('name') ?? '').trim();
    const signersRaw = String(form.get('signers') ?? '[]');
    const file = form.get('file') as File | null;

    if (!name) return NextResponse.json({ error: 'Nome do contrato é obrigatório.' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'Arquivo PDF é obrigatório.' }, { status: 400 });

    const signers: Signer[] = JSON.parse(signersRaw);
    if (!signers.length) return NextResponse.json({ error: 'Adicione ao menos um signatário.' }, { status: 400 });

    const doc = await createDocument(name, signers, file);
    return NextResponse.json(doc);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar contrato' },
      { status: 500 },
    );
  }
}
