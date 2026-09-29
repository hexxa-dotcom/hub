'use client';

import { useState, useTransition } from 'react';
import { FileSignature, Loader2, ChevronDown } from 'lucide-react';
import { aceitarContratoAction } from './contrato-actions';

/**
 * Entrada do cliente antes de usar o Hub: o Termo de Adesão com os dados dele
 * e os dois documentos para ler. Um aceite só, com prova gravada no servidor.
 */
export function AceiteDoContrato({
  empresa,
  linhas,
  contrato,
  termos,
  versaoContrato,
  versaoTermos,
}: {
  empresa: string;
  linhas: { rotulo: string; valor: string }[];
  contrato: React.ReactNode;
  termos: React.ReactNode;
  versaoContrato: string;
  versaoTermos: string;
}) {
  const [li, setLi] = useState(false);
  const [aberto, setAberto] = useState<'contrato' | 'termos' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const aceitar = () =>
    iniciar(async () => {
      setErro(null);
      const r = await aceitarContratoAction().catch(() => ({ ok: false, mensagem: 'Não foi possível registrar o aceite. Tente de novo.' }));
      if (!r.ok) setErro(r.mensagem);
      else window.location.reload();
    });

  const Documento = ({ id, titulo, versao, children }: { id: 'contrato' | 'termos'; titulo: string; versao: string; children: React.ReactNode }) => (
    <div className="rounded-2xl border border-black/10 dark:border-white/10">
      <button
        type="button"
        onClick={() => setAberto(aberto === id ? null : id)}
        aria-expanded={aberto === id}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-[#231F20] dark:text-[#F5F6F4]">{titulo}</span>
          <span className="block text-xs text-[#6E6A61] dark:text-[#A8A49C]">{versao}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-[#6E6A61] transition-transform duration-200 ${aberto === id ? 'rotate-180' : ''}`} />
      </button>
      {aberto === id && <div className="max-h-[45vh] overflow-y-auto border-t border-black/10 px-4 py-4 dark:border-white/10">{children}</div>}
    </div>
  );

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F6F4] px-4 py-10 dark:bg-[#0E1110]">
      <div className="w-full max-w-2xl rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-[#121614]">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
          <FileSignature className="h-6 w-6 text-emerald-700 dark:text-emerald-400" />
        </div>
        <h1 className="text-lg font-light uppercase tracking-[0.05em] text-ink">Antes de começar</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6E6A61] dark:text-[#A8A49C]">
          Confira o contrato de serviços contábeis de <strong className="text-[#231F20] dark:text-[#F5F6F4]">{empresa}</strong> com a Hexx.
          Depois de aceito, ele fica disponível em Contratos.
        </p>

        <div className="mt-5 rounded-2xl bg-[#F5F6F4] p-4 dark:bg-[#0E1110]">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6E6A61] dark:text-[#A8A49C]">Termo de Adesão</p>
          <dl className="space-y-1.5 text-sm">
            {linhas.map((l) => (
              <div key={l.rotulo} className="grid grid-cols-[110px_1fr] gap-3">
                <dt className="text-[#6E6A61] dark:text-[#A8A49C]">{l.rotulo}</dt>
                <dd className="min-w-0 text-[#231F20] [overflow-wrap:anywhere] dark:text-[#F5F6F4]">{l.valor}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="mt-4 space-y-2">
          <Documento id="contrato" titulo="Contrato de Prestação de Serviços Contábeis" versao={versaoContrato}>{contrato}</Documento>
          <Documento id="termos" titulo="Termos de Uso e Política de Privacidade" versao={versaoTermos}>{termos}</Documento>
        </div>

        <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm text-[#231F20] dark:text-[#F5F6F4]">
          <input type="checkbox" checked={li} onChange={(e) => setLi(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-700" />
          <span>Li e aceito o contrato e os termos, em nome da empresa, como seu representante.</span>
        </label>

        {erro && <p className="mt-3 text-xs text-red-600 dark:text-red-400">{erro}</p>}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            disabled={!li || enviando}
            onClick={aceitar}
            className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] px-6 py-3 text-sm font-semibold text-[#DFFFAE] transition-colors hover:bg-[#2F4A3C] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {enviando && <Loader2 className="h-4 w-4 animate-spin" />} Aceitar e entrar
          </button>
        </div>
      </div>
    </main>
  );
}
