'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Info, RotateCw, AlertTriangle, ExternalLink } from 'lucide-react';
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
        <span className={`text-sm ${muted ? 'text-[#FEFDF3]/70' : 'text-[#FEFDF3]'}`}>{label}</span>
        {source && <p className="text-[10px] text-[#FEFDF3]/40">{source}</p>}
      </div>
      <span className={`text-sm font-bold ${cls}`}>{BRL.format(value)}</span>
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
    <div className="rounded-3xl bg-[#1E3328] p-6 sm:p-8 text-[#FEFDF3] shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-[#DFFFAE]" />
            <h2 className="font-serif font-bold text-lg text-[#FEFDF3]">Lucro Disponível para Distribuição</h2>
          </div>
          <p className="mt-1 text-xs text-[#DFFFAE]/80 capitalize">{mesAtual}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={fetchData}
            disabled={refreshing}
            className="rounded-full p-2 text-[#DFFFAE]/70 hover:bg-white/10 hover:text-[#DFFFAE] disabled:opacity-40 transition-colors"
            aria-label="Atualizar"
          >
            <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => setShowInfo(v => !v)}
            className="rounded-full p-2 text-[#DFFFAE]/70 hover:bg-white/10 hover:text-[#DFFFAE] transition-colors"
            aria-label="Informações"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="mt-4 rounded-2xl bg-white/10 p-4 text-xs text-[#FEFDF3]/90 space-y-2">
          <p><strong className="text-[#DFFFAE]">Com escrituração contábil regular:</strong> 100% do lucro líquido apurado pode ser distribuído sem incidência de IRPF (Art. 10 da Lei nº 9.249/1995).</p>
          <p><strong className="text-[#DFFFAE]">Sem escrituração completa:</strong> a isenção de serviços é limitada a 32% da receita bruta.</p>
          <p><strong className="text-[#DFFFAE]">Reserva de segurança:</strong> parcela recomendada para preservação de capital de giro e investimentos.</p>
          <div className="mt-2 flex flex-wrap gap-3 border-t border-white/15 pt-2">
            <span className="inline-flex items-center gap-1 text-[#DFFFAE]/80">
              <ExternalLink className="h-3 w-3" /> Faturamento: NFSe emitidas no mês
            </span>
            <span className="inline-flex items-center gap-1 text-[#DFFFAE]/80">
              <ExternalLink className="h-3 w-3" /> Despesas: Contas pagas no Financeiro
            </span>
            <span className="inline-flex items-center gap-1 text-[#DFFFAE]/80">
              <ExternalLink className="h-3 w-3" /> DAS: Guia única quitada no mês
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 text-[#DFFFAE]/70">
          <RotateCw className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Carregando dados financeiros…</span>
        </div>
      ) : (
        <div className="mt-6 rounded-2xl bg-white/10 p-5 space-y-1">
          <ResultRow
            label="Faturamento bruto"
            value={faturamento}
            cls="text-[#FEFDF3]"
            source="Notas Fiscais emitidas no mês"
          />
          <ResultRow
            label="(−) Despesas pagas"
            value={-despesas}
            cls="text-[#FEFDF3]/80"
            muted
            source="Hub Financeiro · contas pagas no mês"
          />
          <ResultRow
            label="(−) DAS pago"
            value={-das}
            cls="text-[#FEFDF3]/80"
            muted
            source="Guias de Impostos · DAS pago no mês"
          />
          <div className="border-t border-white/15 pt-2 mt-1">
            <ResultRow
              label="= Lucro líquido apurado"
              value={lucroLiquido}
              cls="text-[#DFFFAE] font-extrabold text-base"
            />
          </div>

          <div className="mt-3 border-t border-white/15 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-[#FEFDF3]/80 uppercase tracking-wider">Reserva de Capital de Giro</span>
              <div className="flex items-center gap-1">
                {[10, 20, 30].map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setReservaPct(p)}
                    className={`rounded-full px-3 py-0.5 text-xs font-bold transition-all ${
                      reservaPct === p ? 'bg-[#DFFFAE] text-[#1E3328]' : 'text-[#FEFDF3]/70 hover:text-white'
                    }`}
                  >
                    {p}%
                  </button>
                ))}
              </div>
            </div>
            <ResultRow
              label={`Reserva ${reservaPct}% — retida em caixa`}
              value={reserva}
              cls="text-[#FEFDF3]/70"
              muted
            />
          </div>

          <div className="mt-4 rounded-2xl bg-[#DFFFAE] px-5 py-4 text-[#1E3328]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs uppercase tracking-wider text-[#2F4A3C]">Distribuível aos Sócios</span>
              <span className="font-serif font-extrabold text-2xl sm:text-3xl text-[#1E3328]">{BRL.format(distribuivel)}</span>
            </div>
            <p className="mt-0.5 text-xs text-[#2F4A3C]/80 font-medium">100% Isento de IRPF com escrituração contábil regular</p>
          </div>

          {ultrapassaLimite && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-500/20 border border-amber-500/30 p-3.5 text-xs text-[#FEFDF3]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <span>
                Sem contabilidade formal, o limite isento para serviços é{' '}
                <strong>{BRL.format(limitePresumido)}</strong> (32% da receita bruta).
                Com a escrituração contábil completa da Hexxa, todo o valor apurado é isento.
              </span>
            </div>
          )}

          {faturamento === 0 && !loading && (
            <p className="mt-3 text-center text-xs text-[#FEFDF3]/60">
              Nenhuma nota fiscal emitida neste mês até o momento.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

