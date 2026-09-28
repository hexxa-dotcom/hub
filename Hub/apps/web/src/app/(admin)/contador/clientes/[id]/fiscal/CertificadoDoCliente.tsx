'use client';

import { useActionState } from 'react';
import { Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { enviarCertificadoDoClienteAction, type EstadoDoCertificado } from './actions';

/**
 * Certificado A1 do cliente, pela área do contador: a situação de hoje e o
 * envio (ou troca, quando vencer). Ao salvar, o Hub já busca as notas do
 * Emissor Nacional.
 */
export function CertificadoDoCliente({
  companyId,
  situacao,
}: {
  companyId: string;
  situacao: { nivel: string; mensagem: string; validoAte: string | null; titular: string | null } | null;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoDoCertificado, FormData>(
    enviarCertificadoDoClienteAction.bind(null, companyId),
    { ok: false, message: '' },
  );
  const temCertificado = Boolean(situacao?.validoAte);
  const alerta = situacao && situacao.nivel !== 'OK' && situacao.nivel !== 'ok';
  return (
    <div className="space-y-4">
      <p className={`flex items-start gap-2 text-sm ${!temCertificado || alerta ? 'text-amber-800 dark:text-amber-300' : 'text-emerald-800 dark:text-emerald-300'}`}>
        {temCertificado && !alerta ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> : <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>
          {situacao?.mensagem ?? 'Certificado digital não enviado.'}
          {situacao?.titular && <span className="block text-xs text-[#6E6A61] dark:text-[#A8A49C]">Titular: {situacao.titular}</span>}
        </span>
      </p>
      <form action={enviar} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-end">
        <label className="text-xs font-semibold text-[#231F20] dark:text-[#F5F6F4]">
          {temCertificado ? 'Trocar o certificado (.pfx)' : 'Arquivo do certificado (.pfx)'}
          <input name="pfx" type="file" accept=".pfx,.p12" required className="mt-1.5 block w-full text-xs text-[#6E6A61] file:mr-3 file:rounded-full file:border file:border-black/15 file:bg-transparent file:px-3 file:py-1.5 file:text-xs file:font-semibold dark:text-[#A8A49C] dark:file:border-white/20 dark:file:text-[#F5F6F4]" />
        </label>
        <label className="text-xs font-semibold text-[#231F20] dark:text-[#F5F6F4]">
          Senha
          <input name="senha" type="password" required autoComplete="off" className="mt-1.5 w-full rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5" />
        </label>
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] px-5 py-2.5 text-xs font-semibold text-[#DFFFAE] disabled:opacity-60"
        >
          {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {enviando ? 'Enviando e buscando notas…' : 'Enviar certificado'}
        </button>
      </form>
      {estado.message && (
        <p className={`text-xs ${estado.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{estado.message}</p>
      )}
      <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">
        O arquivo e a senha ficam criptografados. Com o certificado, as notas emitidas e recebidas chegam sozinhas todo dia — e o Hub avisa 30, 15 e 7 dias antes de
        vencer.
      </p>
    </div>
  );
}
