'use client';

import { useState, useTransition, useEffect } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownRight, Loader2, Landmark } from 'lucide-react';
import { syncDfeAction, getDfeSummaryAction, listDfeDocsAction } from './dfeActions';
import type { DistribuicaoResumoMes, DistribuicaoDocRow } from '@/lib/server/nfse-dfe-sync';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mesLabel = (mes: string) => {
  const [ano, m] = mes.split('-');
  const d = new Date(Number(ano), Number(m) - 1, 1);
  return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
};

/**
 * Mostra o valor real de toda nota emitida OU recebida pelo CNPJ da empresa,
 * puxado direto da Distribuição de DF-e do Sistema Nacional NFS-e — funciona
 * mesmo sem o município estar liberado pra emissão pelo Hub (ex: Navegantes),
 * porque a nota já é replicada no governo assim que emitida por QUALQUER
 * sistema (inclusive o próprio do município).
 */
export function DfeNacionalCard() {
  const [resumo, setResumo] = useState<DistribuicaoResumoMes[] | null>(null);
  const [selectedMes, setSelectedMes] = useState<string | null>(null);
  const [docs, setDocs] = useState<DistribuicaoDocRow[] | null>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [isSyncing, startSync] = useTransition();
  const [isLoadingDocs, startLoadDocs] = useTransition();

  const loadResumo = () => {
    getDfeSummaryAction().then((r) => {
      setResumo(r);
      if (!selectedMes && r[0]) setSelectedMes(r[0].mes);
    });
  };

  useEffect(loadResumo, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedMes) return;
    startLoadDocs(() => listDfeDocsAction(selectedMes).then(setDocs));
  }, [selectedMes]);

  function handleSync() {
    setSyncMsg(null);
    startSync(async () => {
      const res = await syncDfeAction();
      if (res.erro) {
        setSyncMsg(`Erro: ${res.erro}`);
      } else {
        setSyncMsg(
          `${res.documentosNovos} nota(s) nova(s) encontrada(s).${res.temMaisParaSincronizar ? ' Ainda há mais — sincronize de novo.' : ''}`,
        );
        loadResumo();
      }
    });
  }

  const atual = resumo?.find((r) => r.mes === selectedMes);

  return (
    <div className="rounded-3xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#1A201C] p-6 sm:p-7 shadow-sm space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-[#EFFFD6] dark:bg-[#1E3328] p-2">
            <Landmark className="h-4 w-4 text-[#1E3328] dark:text-[#DFFFAE]" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Notas no Emissor Nacional</h3>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
              Valores reais direto do governo — inclui notas emitidas por qualquer sistema (ex: prefeitura).
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] dark:bg-[#DFFFAE] px-4 py-2 text-xs font-bold text-[#DFFFAE] dark:text-[#1E3328] hover:scale-105 transition-transform disabled:opacity-60 disabled:hover:scale-100"
        >
          {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar
        </button>
      </div>

      {syncMsg && (
        <p className="text-xs font-semibold text-[#6E6A61] dark:text-[#A8A49C] bg-black/5 dark:bg-white/5 rounded-xl px-3.5 py-2.5">
          {syncMsg}
        </p>
      )}

      {resumo === null ? (
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Carregando...</p>
      ) : resumo.length === 0 ? (
        <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Nenhuma nota encontrada ainda. Clique em Sincronizar pra buscar direto do Emissor Nacional.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {resumo.map((r) => (
              <button
                key={r.mes}
                onClick={() => setSelectedMes(r.mes)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold capitalize transition-colors ${
                  selectedMes === r.mes
                    ? 'bg-[#231F20] text-[#FEFDF3] dark:bg-[#FEFDF3] dark:text-[#231F20]'
                    : 'bg-black/5 text-[#6E6A61] hover:bg-black/10 dark:bg-white/5 dark:text-[#A8A49C] dark:hover:bg-white/10'
                }`}
              >
                {mesLabel(r.mes)}
              </button>
            ))}
          </div>

          {atual && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#EFFFD6] dark:bg-[#1E3328] px-4 py-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
                  <ArrowUpRight className="h-3 w-3" /> Emitidas ({atual.qtdEmitido})
                </div>
                <span className="text-lg font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">{fmt(atual.totalEmitido)}</span>
              </div>
              <div className="rounded-2xl bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-amber-800 dark:text-amber-300">
                  <ArrowDownRight className="h-3 w-3" /> Recebidas ({atual.qtdRecebido})
                </div>
                <span className="text-lg font-bold text-amber-900 dark:text-amber-200">{fmt(atual.totalRecebido)}</span>
              </div>
            </div>
          )}

          {isLoadingDocs ? (
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Carregando notas...</p>
          ) : docs && docs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {docs.map((d) => (
                <div
                  key={d.chaveAcesso}
                  className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 ${
                    d.cancelado
                      ? 'border-black/5 dark:border-white/5 opacity-50'
                      : 'border-black/5 dark:border-white/10'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#231F20] dark:text-[#FEFDF3] truncate">
                      {d.direction === 'EMITIDA' ? d.tomadorNome ?? 'Cliente' : d.prestadorNome ?? 'Fornecedor'}
                      {d.cancelado && <span className="ml-2 text-[10px] font-bold text-red-500">CANCELADA</span>}
                    </p>
                    <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C] truncate">
                      {d.descricaoServico ?? '—'} · {d.municipioEmissao ?? '—'}
                      {d.dataEmissao ? ` · ${new Date(d.dataEmissao).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-bold ${
                      d.direction === 'EMITIDA'
                        ? 'text-[#2F4A3C] dark:text-[#DFFFAE]'
                        : 'text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {d.direction === 'EMITIDA' ? '+' : '−'}
                    {fmt(d.valorLiquido ?? d.valorServico ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Nenhuma nota neste mês.</p>
          )}
        </>
      )}
    </div>
  );
}
