/**
 * TRAVA DO APARELHO — login completo de tempos em tempos, código rápido no dia a dia.
 *
 * A sessão do Supabase dura; o que decide se a pessoa entra direto é este
 * cookie assinado, gravado no login completo (e-mail + código por e-mail):
 *   f — quando foi o último login completo NESTE aparelho (vale 30 dias);
 *   d — até quando está desbloqueado (12 h após o código rápido);
 *   p — se a pessoa tem código rápido. Sem código, não há bloqueio curto.
 * Assinado com HMAC (Web Crypto) para rodar também no proxy.
 */
export const TRAVA_COOKIE = 'hexx_trava';
export const LOGIN_COMPLETO_VALE_MS = 30 * 24 * 3600_000;
export const DESBLOQUEIO_VALE_MS = 12 * 3600_000;

export type Trava = { u: string; f: number; d: number; p: boolean };

const enc = new TextEncoder();

async function chave(): Promise<CryptoKey> {
  const segredo = process.env.ENCRYPTION_KEY;
  if (!segredo) throw new Error('ENCRYPTION_KEY ausente');
  return crypto.subtle.importKey('raw', enc.encode(`trava:${segredo}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function assinarTrava(t: Trava): Promise<string> {
  const corpo = b64(enc.encode(JSON.stringify(t)));
  return `${corpo}.${b64(await crypto.subtle.sign('HMAC', await chave(), enc.encode(corpo)))}`;
}

export async function lerTrava(valor: string | undefined): Promise<Trava | null> {
  if (!valor) return null;
  const [corpo, sig] = valor.split('.');
  if (!corpo || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await chave(), deB64(sig), enc.encode(corpo));
    return ok ? (JSON.parse(new TextDecoder().decode(deB64(corpo))) as Trava) : null;
  } catch {
    return null;
  }
}

export const opcoesDaTrava = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: LOGIN_COMPLETO_VALE_MS / 1000,
};
