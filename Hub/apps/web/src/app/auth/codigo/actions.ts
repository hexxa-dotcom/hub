'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type AccessArea = 'cliente' | 'contador';

const COOKIE: Record<AccessArea, string> = {
  cliente: 'hexx_access_cliente',
  contador: 'hexx_access_contador',
};

function expectedCode(area: AccessArea): string | undefined {
  return area === 'cliente' ? process.env.ACCESS_CODE_CLIENTE : process.env.ACCESS_CODE_CONTADOR;
}

export async function verifyAccessCodeAction(area: AccessArea, code: string, next: string) {
  const expected = expectedCode(area);
  if (!expected) {
    return { error: 'Código de acesso não configurado no servidor.' };
  }
  if (code.trim() !== expected) {
    return { error: 'Código incorreto.' };
  }

  const jar = await cookies();
  jar.set(COOKIE[area], expected, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 dias
    path: '/',
  });

  redirect((next || (area === 'contador' ? '/contador' : '/cliente')) as never);
}
