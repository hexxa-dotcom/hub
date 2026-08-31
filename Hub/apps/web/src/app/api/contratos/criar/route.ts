import { NextResponse } from 'next/server';
import { makeContractSignatureService } from '@/lib/server/container';
import { getTenantContext } from '@/lib/server/tenant';

type SignerInput = { name: string; email: string; role?: string };

export async function POST(req: Request) {
  try {
    // req.formData() não depende de ctx — dispara as duas em paralelo em vez
    // de esperar auth+DB antes de começar a ler o corpo da requisição.
    const [ctx, form] = await Promise.all([getTenantContext(), req.formData()]);
    const name = String(form.get('name') ?? '').trim();
    const signersRaw = String(form.get('signers') ?? '[]');
    const file = form.get('file') as File | null;

    if (!name) return NextResponse.json({ error: 'Nome do contrato é obrigatório.' }, { status: 400 });
    if (!file) return NextResponse.json({ error: 'Arquivo PDF é obrigatório.' }, { status: 400 });

    const signers: SignerInput[] = JSON.parse(signersRaw);
    const validSigners = signers.filter((s) => s.email?.trim());
    if (!validSigners.length) return NextResponse.json({ error: 'Adicione ao menos um signatário com e-mail.' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    const service = makeContractSignatureService();
    const result = await service.send(ctx, {
      title: name,
      documentBuffer: { base64, filename: file.name || 'contrato.pdf' },
      signers: validSigners.map((s, i) => ({
        name: s.name?.trim() || s.email,
        email: s.email.trim(),
        role: s.role?.trim() || `Parte ${i + 1}`,
      })),
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao criar contrato' },
      { status: 500 },
    );
  }
}
