import { NextResponse } from 'next/server';
import { listDocuments } from '@/lib/autentique';

export async function GET() {
  try {
    const docs = await listDocuments();
    return NextResponse.json(docs);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao buscar contratos' },
      { status: 500 },
    );
  }
}
