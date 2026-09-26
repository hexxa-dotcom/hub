'use client';

import { useState, useTransition, useEffect } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownRight, Loader2, Landmark } from 'lucide-react';
import { syncDfeAction, getDfeSummaryAction, listDfeDocsAction } from './dfeActions';
import type { DistribuicaoResumoMes, DistribuicaoDocRow } from '@/lib/server/nfse-dfe-sync';
import { Card } from '@/components/ui/Card';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mesLabel = (mes: string) => {
  const [ano, m] = mes.split('-');
  const d = new Date(Number(ano), Number(m) - 1, 1);
  return d.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
};

/**
 * Mostra o valor real de toda nota emitida OU recebida pelo CNPJ da empresa,
 * puxado direto da Distribuição de DF-e do Sistema Nacional NFS-e — funciona
 * mesmo sem o município estar liberado pra emissão pela Hexx (ex: Navegantes),
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
    <Card level={1} className="p-6 sm:p-7 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-surface-card shadow-(--elev-inset) p-2">
            <Landmark className="h-4 w-4 text-hexxa-green dark:text-hexxa-lime" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink">Notas no Emissor Nacional</h3>
            <p className="text-xs text-ink-soft">
              Valores reais direto do governo — inclui notas emitidas por qualquer sistema (ex: prefeitura).
            </p>
          </div>
        </div>
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest hover:bg-hexxa-green px-4 py-2 text-xs font-bold text-hexxa-lime shadow-(--elev-1) transition-all disabled:opacity-60"
        >
          {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar
        </button>
      </div>

      {syncMsg && (
        <p className="text-xs font-semibold text-ink-soft bg-surface-card shadow-(--elev-inset) rounded-xl px-3.5 py-2.5">
          {syncMsg}
        </p>
      )}

      {resumo === null ? (
        <p className="text-xs text-ink-soft">Carregando...</p>
      ) : resumo.length === 0 ? (
        <p className="text-xs text-ink-soft">
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
                    ? 'bg-hexxa-forest text-hexxa-lime shadow-(--elev-inset)'
                    : 'bg-surface-card shadow-(--elev-1) hover:shadow-(--elev-2) text-ink-soft hover:text-ink'
                }`}
              >
                {mesLabel(r.mes)}
              </button>
            ))}
          </div>

          {atual && (
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) px-4 py-3">
                <div className="rotulo flex items-center gap-1.5 text-hexxa-green dark:text-hexxa-lime">
                  <ArrowUpRight className="h-3 w-3" /> Emitidas ({atual.qtdEmitido})
                </div>
                <span className="text-lg font-serif font-bold tabular text-hexxa-green dark:text-hexxa-lime">{fmt(atual.totalEmitido)}</span>
              </div>
              <div className="rounded-2xl bg-surface-card shadow-(--elev-inset) px-4 py-3">
                <div className="rotulo flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <ArrowDownRight className="h-3 w-3" /> Recebidas ({atual.qtdRecebido})
                </div>
                <span className="text-lg font-serif font-bold tabular text-amber-700 dark:text-amber-300">{fmt(atual.totalRecebido)}</span>
              </div>
            </div>
          )}

          {isLoadingDocs ? (
            <p className="text-xs text-ink-soft">Carregando notas...</p>
          ) : docs && docs.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {docs.map((d) => (
                <div
                  key={d.chaveAcesso}
                  className={`flex items-center justify-between gap-3 rounded-xl bg-surface-card shadow-(--elev-inset) px-3.5 py-2.5 ${
                    d.cancelado ? 'opacity-50' : ''
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-ink truncate">
                      {d.direction === 'EMITIDA' ? d.tomadorNome ?? 'Cliente' : d.prestadorNome ?? 'Fornecedor'}
                      {d.cancelado && <span className="ml-2 text-[10px] font-bold text-expense">CANCELADA</span>}
                    </p>
                    <p className="text-[11px] text-ink-soft truncate">
                      {d.descricaoServico ?? '—'} · {d.municipioEmissao ?? '—'}
                      {d.dataEmissao ? ` · ${new Date(d.dataEmissao).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 text-sm font-serif font-bold tabular ${
                      d.direction === 'EMITIDA'
                        ? 'text-hexxa-green dark:text-hexxa-lime'
                        : 'text-amber-700 dark:text-amber-300'
                    }`}
                  >
                    {d.direction === 'EMITIDA' ? '+' : '−'}
                    {fmt(d.valorLiquido ?? d.valorServico ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft">Nenhuma nota neste mês.</p>
          )}
        </>
      )}
    </Card>
  );
}
