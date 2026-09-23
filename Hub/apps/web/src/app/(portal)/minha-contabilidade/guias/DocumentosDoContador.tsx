'use client';

import { useState } from 'react';
import { FileText, Download, Eye, CheckCircle2, Copy, Check } from 'lucide-react';
import type { Entrega } from '@/lib/server/entregas';
import { confirmarRecebimentoAction } from './entregas-actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

/**
 * O que a contabilidade entregou, com protocolo. Abrir e baixar passam pela
 * rota que registra o acesso — nunca pelo arquivo direto.
 */
export function DocumentosDoContador({ entregas, tipos }: { entregas: Entrega[]; tipos: Record<string, string> }) {
  const [lista, setLista] = useState(entregas);
  const [aviso, setAviso] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);

  async function confirmar(id: string) {
    const r = await confirmarRecebimentoAction(id);
    setAviso(r.message);
    if (r.ok) setLista((l) => l.map((e) => (e.id === id ? { ...e, confirmadoEm: new Date().toISOString() } : e)));
  }

  if (lista.length === 0) {
    return (
      <div className="rounded-3xl border border-black/5 bg-white/80 p-10 text-center text-sm text-[#6E6A61] dark:border-white/10 dark:bg-white/5">
        Nenhum documento enviado pela sua contabilidade ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {aviso && <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">{aviso}</p>}
      {lista.map((e) => (
        <article key={e.id} className="rounded-2xl border border-black/5 bg-white/80 p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-wrap items-start gap-3">
            <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[#6E6A61]" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">{e.titulo}</p>
              <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                {e.origem === 'ONEFLOW' ? 'Guia de imposto' : tipos[e.tipo]} · protocolo <strong>{e.protocolo}</strong> · recebido em{' '}
                {dataHora(e.enviadoEm)}
              </p>
              {(e.valor != null || e.vencimento) && (
                <p className="mt-1 text-sm text-[#231F20] dark:text-[#F5F6F4]">
                  {e.valor != null && <strong>{BRL.format(e.valor)}</strong>}
                  {e.vencimento && <span className="text-[#6E6A61]"> · vence em {data(e.vencimento)}</span>}
                  {e.pago && <span className="ml-2 text-xs font-bold text-emerald-700">Pago</span>}
                </p>
              )}
              {e.descricao && <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{e.descricao}</p>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2 pl-8">
            {e.temArquivo && (
              <>
                <a
                  href={`/api/documentos/${e.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#1E3328] px-3.5 py-1.5 text-xs font-bold text-[#DFFFAE]"
                >
                  <Eye className="h-3.5 w-3.5" /> Abrir
                </a>
                <a
                  href={`/api/documentos/${e.id}?modo=baixar`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-bold text-[#231F20] dark:border-white/10 dark:text-[#F5F6F4]"
                >
                  <Download className="h-3.5 w-3.5" /> Baixar
                </a>
              </>
            )}
            {e.pixCode && !e.pago && (
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(e.pixCode!);
                  setCopiado(e.id);
                  setTimeout(() => setCopiado(null), 2000);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3.5 py-1.5 text-xs font-bold text-[#231F20] dark:border-white/10 dark:text-[#F5F6F4]"
              >
                {copiado === e.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copiar Pix
              </button>
            )}
            {e.confirmadoEm ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" /> Recebimento confirmado
              </span>
            ) : (
              <button
                type="button"
                onClick={() => confirmar(e.id)}
                className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/40 px-3.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Recebi
              </button>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}
