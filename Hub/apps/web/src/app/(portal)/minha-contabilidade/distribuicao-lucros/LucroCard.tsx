'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendUp, Info, ArrowsClockwise, Warning, ArrowSquareOut } from '@phosphor-icons/react';
import { getLancamentos } from '@/app/(portal)/meu-negocio/hub-financeiro/actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const mesAtual = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
const currentMonth = new Date().toISOString().slice(0, 7);

type Dados = {
  faturamento: number;
  despesas: number;
  das: number;
  loading: boolean;
  error: string | null;
};

function ResultRow({ label, value, cls = '', muted = false, source }: {
  label: string; value: number; cls?: string; muted?: boolean; source?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <span className={`text-sm ${muted ? 'text-white/60' : ''}`}>{label}</span>
        {source && <p className="text-[10px] text-white/40">{source}</p>}
      </div>
      <span className={`text-sm font-semibold ${cls}`}>{BRL.format(value)}</span>
    </div>
  );
}

export function LucroCard() {
  const [dados, setDados] = useState<Dados>({ faturamento: 0, despesas: 0, das: 0, loading: true, error: null });
  const [reservaPct, setReservaPct] = useState(20);
  const [showInfo, setShowInfo] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [notasRes, lancs, guiasRes] = await Promise.all([
        fetch('/api/notas/resumo'),
        getLancamentos(),
        fetch('/api/guias/resumo'),
      ]);

      const notasJson  = notasRes.ok  ? await notasRes.json()  : { total: 0 };
      const guiasJson  = guiasRes.ok  ? await guiasRes.json()  : { dasPago: 0 };

      // Despesas pagas no mês atual (tipo PAGAR + pago_em no mês)
      const despesasPagas = lancs
        .filter((l) => l.tipo === 'PAGAR' && l.pago_em?.startsWith(currentMonth))
        .reduce((s, l) => s + Number(l.valor), 0);

      setDados({
        faturamento: notasJson.total ?? 0,
        despesas: despesasPagas,
        das: guiasJson.dasPago ?? 0,
        loading: false,
        error: null,
      });
    } catch {
      setDados(prev => ({ ...prev, loading: false, error: 'Não foi possível carregar os dados.' }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const { faturamento, despesas, das, loading } = dados;
  const lucroLiquido = Math.max(0, faturamento - despesas - das);
  const reserva = lucroLiquido * (reservaPct / 100);
  const distribuivel = Math.max(0, lucroLiquido - reserva);

  // Limite sem contabilidade formal (serviços = 32% receita bruta)
  const limitePresumido = faturamento * 0.32;
  const ultrapassaLimite = faturamento > 0 && distribuivel > limitePresumido;

  return (
    <div className="card-highlight rounded-card p-5 text-white">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendUp className="h-5 w-5 text-white/80" />
            <h2 className="text-base font-semibold">Lucro disponível para distribuição</h2>
          </div>
          <p className="mt-0.5 text-xs text-white/60 capitalize">{mesAtual}</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={fetchData} disabled={refreshing}
            className="rounded-xl p-1.5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="Atualizar">
            <ArrowsClockwise className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button type="button" onClick={() => setShowInfo(v => !v)}
            className="rounded-xl p-1.5 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Informações">
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/80 space-y-1.5">
          <p><strong className="text-white">Com contabilidade regular:</strong> todo o lucro líquido pode ser distribuído sem incidência de IRPF (Art. 10, Lei 9.249/95).</p>
          <p><strong className="text-white">Sem contabilidade formal:</strong> o limite isento para serviços é 32% da receita bruta. Acima disso, incide IRPF sobre o excedente.</p>
          <p><strong className="text-white">Reserva de capital:</strong> valor não distribuído fica no caixa da empresa como capital de giro.</p>
          <div className="mt-1 flex flex-wrap gap-2 border-t border-white/20 pt-2">
            <span className="inline-flex items-center gap-1 text-white/60">
              <ArrowSquareOut className="h-3 w-3" />Faturamento: Notas Fiscais emitidas no mês
            </span>
            <span className="inline-flex items-center gap-1 text-white/60">
              <ArrowSquareOut className="h-3 w-3" />Despesas: Hub Financeiro (contas pagas no mês)
            </span>
            <span className="inline-flex items-center gap-1 text-white/60">
              <ArrowSquareOut className="h-3 w-3" />DAS: Guias de Impostos (DAS marcado como pago no mês)
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-white/60">
          <ArrowsClockwise className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando dados…</span>
        </div>
      ) : (
        <div className="mt-4 rounded-xl bg-white/10 p-4">
          <ResultRow
            label="Faturamento bruto"
            value={faturamento}
            cls="text-white"
            source="Notas Fiscais emitidas no mês"
          />
          <ResultRow
            label="(−) Despesas pagas"
            value={-despesas}
            cls="text-white/70"
            muted
            source="Hub Financeiro · contas pagas no mês"
          />
          <ResultRow
            label="(−) DAS pago"
            value={-das}
            cls="text-white/70"
            muted
            source="Guias de Impostos · DAS pago no mês"
          />
          <div className="border-t border-white/20 pt-2 mt-1">
            <ResultRow
              label="= Lucro líquido"
              value={lucroLiquido}
              cls="text-white font-bold"
            />
          </div>

          <div className="mt-3 border-t border-white/20 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-white/70">Reserva de capital</span>
              <div className="flex items-center gap-1">
                {[10, 20, 30].map(p => (
                  <button key={p} type="button" onClick={() => setReservaPct(p)}
                    className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${reservaPct === p ? 'bg-white text-brand-700' : 'text-white/60 hover:text-white'}`}>
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <ResultRow
              label={`Reserva ${reservaPct}% — fica no caixa`}
              value={reserva}
              cls="text-white/60"
              muted
            />
          </div>

          <div className="mt-3 rounded-xl bg-white/20 px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Distribuível aos sócios</span>
              <span className="text-xl font-bold">{BRL.format(distribuivel)}</span>
            </div>
            <p className="mt-0.5 text-xs text-white/70">Isento de IRPF com contabilidade regular</p>
          </div>

          {ultrapassaLimite && (
            <div className="mt-2 flex items-start gap-2 rounded-xl bg-warn/20 p-3 text-xs text-white/90">
              <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
              <span>
                Sem contabilidade formal, o limite isento (serviços) é{' '}
                <strong>{BRL.format(limitePresumido)}</strong> (32% do faturamento).
                O excedente de <strong>{BRL.format(distribuivel - limitePresumido)}</strong> estaria sujeito ao IRPF.
                Com escrituração contábil completa, todo o valor é isento.
              </span>
            </div>
          )}

          {faturamento === 0 && !loading && (
            <p className="mt-3 text-center text-xs text-white/50">
              Nenhuma nota emitida este mês encontrada. Emita notas ou verifique o mês de referência.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
