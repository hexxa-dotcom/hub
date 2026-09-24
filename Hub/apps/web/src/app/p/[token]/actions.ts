'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { decidirProposta } from '@/lib/server/propostas';

/** O cliente aceita ou recusa a proposta pelo link (sem login). */
export async function decidirPropostaAction(token: string, aceitar: boolean, nome: string, email: string, nota: string) {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
  const r = await decidirProposta(token, { aceitar, nome, email, nota }, ip);
  revalidatePath(`/p/${token}`);
  return r;
}
