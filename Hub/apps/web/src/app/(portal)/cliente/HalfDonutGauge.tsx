'use client';

export function HalfDonutGauge({
  percentage = 68,
  title = 'Progresso da Meta',
  subtitle = 'Meta Mensal Faturada',
  realizadoLabel = 'Faturado',
  restanteLabel = 'A Realizar',
  margemLabel = 'Margem Líquida',
  margemValue = '42%',
}: {
  percentage?: number;
  title?: string;
  subtitle?: string;
  realizadoLabel?: string;
  restanteLabel?: string;
  margemLabel?: string;
  margemValue?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percentage));

  // Arco de 180 graus (semicírculo)
  // Raio: 80, Centro: (110, 100)
  // Comprimento do semicírculo: PI * R = 3.14159 * 80 ≈ 251.32
  const radius = 76;
  const strokeWidth = 22;
  const circumference = Math.PI * radius; // metade da circunferência
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div data-card="true" className="rounded-[28px] bg-white/60 dark:bg-[#151916]/60 backdrop-blur-xl border border-white/60 dark:border-white/10 ring-1 ring-inset ring-white/50 dark:ring-white/5 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col justify-between h-full group">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <p className="text-xs text-ink-soft mt-0.5">{subtitle}</p>
        </div>
        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
          Em dia
        </span>
      </div>

      {/* Semicírculo SVG com texto centralizado com precisão matemática */}
      <div className="relative flex flex-col items-center justify-center my-auto pt-2 pb-1">
        <svg viewBox="0 0 220 115" className="w-full max-w-[240px] overflow-visible">
          <defs>
            {/* Padrão de hachura diagonal para o trecho restante (estilo Donezo) */}
            <pattern id="gaugeHatch" width="6" height="6" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
              <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="2" className="text-black/15 dark:text-white/15" />
            </pattern>
            {/* Gradiente sutil verde floresta para o preenchimento */}
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1E3328" />
              <stop offset="100%" stopColor="#2E6247" />
            </linearGradient>
          </defs>

          {/* Arco de fundo hachurado (trecho total / restante) */}
          <path
            d="M 34 100 A 76 76 0 0 1 186 100"
            fill="none"
            stroke="url(#gaugeHatch)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Arco de progresso preenchido */}
          <path
            d="M 34 100 A 76 76 0 0 1 186 100"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out text-[#1E3328] dark:text-[#DFFFAE]"
          />

          {/* Informações centrais com folga ampla em relação ao arco superior */}
          <text
            x="110"
            y="86"
            textAnchor="middle"
            className="fill-neutral-900 dark:fill-white font-serif font-extrabold tabular"
            style={{ fontSize: '29px', fontWeight: 800 }}
          >
            {clamped}%
          </text>
          <text
            x="110"
            y="101"
            textAnchor="middle"
            className="fill-neutral-500 dark:fill-neutral-400 font-sans font-bold uppercase tracking-wider"
            style={{ fontSize: '9px' }}
          >
            {realizadoLabel}
          </text>
        </svg>
      </div>

      {/* Legenda com marcadores estilo Donezo */}
      <div className="flex items-center justify-center gap-4 pt-3 border-t border-black/5 dark:border-white/5 text-[11px] font-medium text-ink-soft">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#1E3328] dark:bg-[#DFFFAE]" />
          <span>{realizadoLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-black/20 dark:bg-white/20" />
          <span>{restanteLabel}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span>{margemLabel}: {margemValue}</span>
        </div>
      </div>
    </div>
  );
}
