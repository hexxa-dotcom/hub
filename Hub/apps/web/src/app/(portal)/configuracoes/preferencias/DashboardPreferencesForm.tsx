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
        <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-800 dark:text-emerald-300 font-bold">
          ✓ Preferências salvas com sucesso. A tela inicial foi atualizada.
        </div>
      )}

      {/* Período do Gráfico */}
      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-5 space-y-3 shadow-sm">
        <div>
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Período do Gráfico de Faturamento</h3>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Quantidade de meses exibidos no histórico da tela inicial.</p>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {[3, 6, 8, 12].map(months => (
            <button
              key={months}
              type="button"
              onClick={() => setConfig(prev => ({ ...prev, chartMonths: months }))}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all ${
                config.chartMonths === months
                  ? 'bg-[#1E3328] text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#1E3328] shadow-sm'
                  : 'border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5'
              }`}
            >
              {months} Meses
            </button>
          ))}
        </div>
      </div>

      {/* Opções da Tela Inicial */}
      <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] p-5 space-y-4 shadow-sm">
        <div>
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3]">Componentes da Tela Inicial</h3>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">Marque quais informações devem ser exibidas no seu painel.</p>
        </div>

        <div className="divide-y divide-black/5 dark:divide-white/10 border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden">
          {/* Gráfico de Faturamento */}
          <div className="flex items-center justify-between p-4 bg-[#FEFDF3] dark:bg-[#121614]">
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Gráfico Histórico de Faturamento</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Evolução dos recebimentos nos últimos meses.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showRevenueChart')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showRevenueChart ? 'bg-[#1E3328] dark:bg-[#2F4A3C]' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showRevenueChart ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Receita por Categoria */}
          <div className="flex items-center justify-between p-4 bg-[#FEFDF3] dark:bg-[#121614]">
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Distribuição de Receita por Categoria</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Composição percentual dos recebimentos do mês.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showCategoryChart')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showCategoryChart ? 'bg-[#1E3328] dark:bg-[#2F4A3C]' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showCategoryChart ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Margem de Lucro Real */}
          <div className="flex items-center justify-between p-4 bg-[#FEFDF3] dark:bg-[#121614]">
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Margem de Lucro Real</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Cálculo de sobra líquida do faturamento após despesas.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showProfitMargin')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showProfitMargin ? 'bg-[#1E3328] dark:bg-[#2F4A3C]' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showProfitMargin ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Quanto Pago de Imposto */}
          <div className="flex items-center justify-between p-4 bg-[#FEFDF3] dark:bg-[#121614]">
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Bússola Tributária (Fator R)</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Enquadramento da faixa tributária e indicador do Fator R.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showTaxThermometer')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showTaxThermometer ? 'bg-[#1E3328] dark:bg-[#2F4A3C]' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showTaxThermometer ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Contratos Pendentes */}
          <div className="flex items-center justify-between p-4 bg-[#FEFDF3] dark:bg-[#121614]">
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Contratos Pendentes & A Vencer</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Resumo de contratos aguardando assinatura ou renovação.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showPendingContracts')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showPendingContracts ? 'bg-[#1E3328] dark:bg-[#2F4A3C]' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showPendingContracts ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </div>

          {/* Contas a Pagar na Semana */}
          <div className="flex items-center justify-between p-4 bg-[#FEFDF3] dark:bg-[#121614]">
            <div>
              <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">Contas a Pagar nos Próximos 7 Dias</p>
              <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Lista de contas com vencimento na semana corrente.</p>
            </div>
            <button
              type="button"
              onClick={() => toggleWidget('showWeeklyPayables')}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                config.showWeeklyPayables ? 'bg-[#1E3328] dark:bg-[#2F4A3C]' : 'bg-black/10 dark:bg-white/10'
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
          className="rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] px-6 py-2.5 text-xs font-bold text-[#DFFFAE] shadow-sm transition-all hover:scale-105"
        >
          Salvar Preferências
        </button>
      </div>
    </form>
  );
}

