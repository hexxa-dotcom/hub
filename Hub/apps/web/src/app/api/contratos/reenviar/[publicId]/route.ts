import { NextResponse } from 'next/server';
import { resendSignature } from '@/lib/autentique';

export async function POST(_req: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  try {
    await resendSignature(publicId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao reenviar' },
      { status: 500 },
    );
  }
}
