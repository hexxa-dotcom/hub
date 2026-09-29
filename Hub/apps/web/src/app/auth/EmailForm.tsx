'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { requestOtpAction, type AuthArea, type RequestOtpState } from './actions';

const initialState: RequestOtpState = { ok: true, message: '' };

const rotulo = { display: 'flex', flexDirection: 'column' as const, gap: 8, fontFamily: 'var(--font-mono), monospace', fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase' as const, color: '#8A8A86' };

/** Login completo: e-mail → código de 6 dígitos por e-mail. */
export function EmailForm({ area, next }: { area: AuthArea; next: string }) {
  const [state, formAction, pending] = useActionState(requestOtpAction, initialState);
  const bloqueado = useSearchParams().get('bloqueado') === '1';

  return (
    <AuthLayout type={area} chave subtitle={area === 'contador' ? 'Acesse a gestão da sua carteira. Enviamos um código de 6 dígitos para o seu e-mail.' : 'Acesse o painel da sua empresa. Enviamos um código de 6 dígitos para o seu e-mail.'}>
      <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <input type="hidden" name="area" value={area} />
        <input type="hidden" name="next" value={next} />
        {bloqueado && (
          <p role="alert" style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: '#B8B8B4', border: '1px solid #3A3A38', padding: '12px 14px' }}>
            Muitas tentativas com o código de acesso. Por segurança, entre pelo e-mail.
          </p>
        )}
        <label style={rotulo}>
          E-mail
          <input
            type="email"
            name="email"
            required
            autoFocus
            autoComplete="email"
            placeholder="voce@empresa.com.br"
            disabled={pending}
            style={{ fontSize: 16, padding: '14px 16px', outline: 'none', letterSpacing: 0, textTransform: 'none', fontFamily: 'var(--font-sora), sans-serif' }}
          />
        </label>
        {!state.ok && state.message && <p role="alert" style={{ margin: 0, fontSize: 14, color: '#F2A38F' }}>{state.message}</p>}
        <button type="submit" disabled={pending} style={{ appearance: 'none', border: 0, cursor: 'pointer', marginTop: 8, fontSize: 16, fontWeight: 600, padding: '17px 20px', opacity: pending ? 0.6 : 1 }}>
          {pending ? 'Enviando…' : 'Receber código →'}
        </button>
      </form>
    </AuthLayout>
  );
}
