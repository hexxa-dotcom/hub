'use client';

import { useState, useEffect } from 'react';

export type DashboardConfig = {
  chartMonths: number;
  showRevenueChart: boolean;
  showCategoryChart: boolean;
  showProfitMargin: boolean;
  showTaxThermometer: boolean;
  showPendingContracts: boolean;
  showPendingInvoices: boolean;
  showWeeklyPayables: boolean;
};

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  chartMonths: 8,
  showRevenueChart: true,
  showCategoryChart: true,
  showProfitMargin: true,
  showTaxThermometer: true,
  showPendingContracts: true,
  showPendingInvoices: true,
  showWeeklyPayables: true,
};

const STORAGE_KEY = 'hexxa.dashboard.config';

export function DashboardPreferencesForm() {
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setConfig(JSON.parse(stored));
    } catch {}
  }, []);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err) {
      console.error('Erro ao salvar preferências:', err);
    }
  }

  function toggleWidget(key: keyof DashboardConfig) {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {savedSuccess && (
        <div className="rounded-xl bg-ok/10 border border-ok/30 p-4 text-xs text-ok font-medium">
          Preferências salvas com sucesso. A tela inicial foi atualizada.
        </div>
      )}

      {/* Período do Gráfico */}
      <div className="rounded-xl border border-line bg-surface-card p-5 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Período do Gráfico de Faturamento</h3>
          <p className="text-xs text-ink-soft">Quantidade de meses exibidos no histórico da tela inicial.</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {[3, 6, 8, 12].map(months => (
            <button
              key={months}
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, chartMonths: months }))}
              className={`rounded-xl px-4 py-2 text-xs font-medium transition-colors ${
                config.chartMonths === months
                  ? 'bg-brand-500 text-white'
                  : 'border border-line bg-surface-card text-ink-soft hover:text-ink'
              }`}
            >
              {months} Meses
            </button>
          ))}
        </div>
      </div>

      {/* Opções da Tela Inicial */}
      <div className="rounded-xl border border-line bg-surface-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Componentes da Tela Inicial</h3>
          <p className="text-xs text-ink-soft">Marque quais informações devem ser exibidas no seu painel.</p>
        </div>

        <div className="divide-y divide-line border border-line rounded-xl overflow-hidden">
          {/* Gráfico de Faturamento */}
          <div className="flex items-center justify-between p-4 bg-surface-card">
            <div>
              <p className="text-sm font-medium text-ink">Gráfico Histórico de Faturamento</p>
              <p className="text-xs text-ink-soft">Evolução dos recebimentos nos últimos meses.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showRevenueChart')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showRevenueChart ? 'bg-brand-500' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showRevenueChart ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Receita por Categoria */}
          <div className="flex items-center justify-between p-4 bg-surface-card">
            <div>
              <p className="text-sm font-medium text-ink">Distribuição de Receita por Categoria</p>
              <p className="text-xs text-ink-soft">Composição percentual dos recebimentos do mês.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showCategoryChart')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showCategoryChart ? 'bg-brand-500' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showCategoryChart ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Margem de Lucro Real */}
          <div className="flex items-center justify-between p-4 bg-surface-card">
            <div>
              <p className="text-sm font-medium text-ink">Margem de Lucro Real</p>
              <p className="text-xs text-ink-soft">Cálculo de sobra líquida do faturamento após despesas.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showProfitMargin')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showProfitMargin ? 'bg-brand-500' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showProfitMargin ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Quanto Pago de Imposto */}
          <div className="flex items-center justify-between p-4 bg-surface-card">
            <div>
              <p className="text-sm font-medium text-ink">Quanto Pago de Imposto (Termômetro & Fator R)</p>
              <p className="text-xs text-ink-soft">Enquadramento da faixa tributária e indicador do Fator R.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showTaxThermometer')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showTaxThermometer ? 'bg-brand-500' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showTaxThermometer ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Contratos Pendentes */}
          <div className="flex items-center justify-between p-4 bg-surface-card">
            <div>
              <p className="text-sm font-medium text-ink">Contratos Pendentes & A Vencer</p>
              <p className="text-xs text-ink-soft">Resumo de contratos aguardando assinatura ou renovação.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showPendingContracts')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showPendingContracts ? 'bg-brand-500' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showPendingContracts ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Contas a Pagar na Semana */}
          <div className="flex items-center justify-between p-4 bg-surface-card">
            <div>
              <p className="text-sm font-medium text-ink">Contas a Pagar nos Próximos 7 Dias</p>
              <p className="text-xs text-ink-soft">Lista de contas com vencimento na semana corrente.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showWeeklyPayables')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showWeeklyPayables ? 'bg-brand-500' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showWeeklyPayables ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          className="rounded-xl bg-brand-500 px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-600 shadow-sm"
        >
          Salvar Preferências
        </button>
      </div>
    </form>
  );
}
