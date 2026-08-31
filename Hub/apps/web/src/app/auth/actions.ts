'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export type AuthArea = 'cliente' | 'contador';

export type RequestOtpState = { ok: boolean; message: string };

/** Dispara o código de 6 dígitos por e-mail. shouldCreateUser cobre cadastro e login com o mesmo fluxo. */
export async function requestOtpAction(
  _prev: RequestOtpState,
  formData: FormData,
): Promise<RequestOtpState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const area = (formData.get('area') === 'contador' ? 'contador' : 'cliente') as AuthArea;
  const next = String(formData.get('next') ?? '');

  if (!email || !email.includes('@')) {
    return { ok: false, message: 'Informe um e-mail válido.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return { ok: false, message: 'Não foi possível enviar o código. Tente novamente em instantes.' };
  }

  const params = new URLSearchParams({ email, area });
  if (next) params.set('next', next);
  redirect(`/auth/verificar?${params.toString()}` as never);
}

export type VerifyOtpState = { error: string } | null;

export async function verifyOtpAction(
  area: AuthArea,
  email: string,
  token: string,
  next: string,
): Promise<VerifyOtpState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });

  if (error) {
    return { error: 'Código incorreto ou expirado.' };
  }

  redirect((next || (area === 'contador' ? '/contador' : '/cliente')) as never);
}
