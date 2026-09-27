/**
 * GRÁFICOS DOS DETALHES — o mês a fundo, na mesma família dos gráficos da
 * Início (SVG à mão, leves, entram desenhando e respeitam o movimento
 * reduzido): a cascata do resultado, o mosaico das despesas, o calendário do
 * caixa, as barras radiais dos clientes e a régua do Simples.
 */

const LIMAO = '#D4FF00';
const ESMERALDA = '#34d399';
const ROSA = '#fb7185';

const compacto = (v: number) => {
  const a = Math.abs(v);
  const s = v < 0 ? '−' : '';
  if (a >= 1_000_000) return `${s}${(a / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`;
  if (a >= 1_000) return `${s}${(a / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: a >= 10_000 ? 0 : 1 })} mil`;
  return `${s}${Math.round(a).toLocaleString('pt-BR')}`;
};

// ── Cascata do resultado ────────────────────────────────────────────────────
export interface Degrau {
  rotulo: string;
  valor: number;
  tipo: 'inicio' | 'sai' | 'fim';
}

export function Cascata({ degraus }: { degraus: Degrau[] }) {
  const W = 560;
  const H = 200;
  const topo = 22;
  const base = H - 30;
  // Onde cada degrau começa e termina, em reais.
  let corrente = 0;
  const barras = degraus.map((d) => {
    if (d.tipo === 'inicio') {
      corrente = d.valor;
      return { ...d, de: 0, ate: d.valor };
    }
    if (d.tipo === 'sai') {
      const de = corrente;
      corrente -= d.valor;
      return { ...d, de, ate: corrente };
    }
    return { ...d, de: 0, ate: d.valor };
  });
  const max = Math.max(1, ...barras.map((b) => Math.max(b.de, b.ate)));
  const min = Math.min(0, ...barras.map((b) => Math.min(b.de, b.ate)));
  const y = (v: number) => topo + ((max - v) / (max - min)) * (base - topo);
  const passo = W / barras.length;
  const larg = Math.min(64, passo * 0.62);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible text-ink" role="img" aria-label="Resultado do mês em cascata">
      <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity="0.12" />
      {barras.map((b, i) => {
        const x = i * passo + (passo - larg) / 2;
        const y0 = y(Math.max(b.de, b.ate));
        const h = Math.max(2, Math.abs(y(b.de) - y(b.ate)));
        const cor = b.tipo === 'inicio' ? ESMERALDA : b.tipo === 'sai' ? ROSA : b.valor >= 0 ? LIMAO : ROSA;
        const prox = barras[i + 1];
        return (
          <g key={b.rotulo}>
            <rect
              x={x}
              y={y0}
              width={larg}
              height={h}
              rx="7"
              fill={cor}
              fillOpacity={b.tipo === 'sai' ? 0.72 : 1}
              className="grafico-surge"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <title>{`${b.rotulo}: ${compacto(b.valor)}`}</title>
            </rect>
            {prox && prox.tipo === 'sai' && (
              <line
                x1={x + larg}
                x2={x + passo}
                y1={y(b.ate)}
                y2={y(b.ate)}
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeDasharray="3 3"
              />
            )}
            <text x={x + larg / 2} y={y0 - 7} textAnchor="middle" fontSize="11" fontWeight="600" className="fill-ink tabular">
              {b.tipo === 'sai' && b.valor >= 0.5 ? '−' : ''}
              {compacto(b.valor)}
            </text>
            <text x={x + larg / 2} y={H - 8} textAnchor="middle" fontSize="11" className="fill-ink-soft">
              {b.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Mosaico (treemap) das categorias ────────────────────────────────────────
type Ret = { x: number; y: number; w: number; h: number };

/** Divide o retângulo em dois grupos de soma parecida, alternando o corte pelo lado maior. */
function mosaico<T extends { valor: number }>(itens: T[], r: Ret): (T & Ret)[] {
  if (itens.length === 0) return [];
  if (itens.length === 1) return [{ ...itens[0]!, ...r }];
  const total = itens.reduce((s, i) => s + i.valor, 0) || 1;
  let acc = 0;
  let corte = 1;
  for (let i = 0; i < itens.length - 1; i++) {
    acc += itens[i]!.valor;
    corte = i + 1;
    if (acc >= total / 2) break;
  }
  const a = itens.slice(0, corte);
  const b = itens.slice(corte);
  const fa = a.reduce((s, i) => s + i.valor, 0) / total;
  if (r.w >= r.h) {
    return [...mosaico(a, { ...r, w: r.w * fa }), ...mosaico(b, { ...r, x: r.x + r.w * fa, w: r.w * (1 - fa) })];
  }
  return [...mosaico(a, { ...r, h: r.h * fa }), ...mosaico(b, { ...r, y: r.y + r.h * fa, h: r.h * (1 - fa) })];
}

const TONS = [
  'bg-rose-400/80 text-rose-950',
  'bg-orange-300/80 text-orange-950',
  'bg-amber-300/80 text-amber-950',
  'bg-emerald-300/70 text-emerald-950',
  'bg-teal-300/60 text-teal-950',
  'bg-black/[0.07] text-ink dark:bg-white/[0.09]',
];

export function MosaicoDeCategorias({ categorias }: { categorias: { nome: string; valor: number }[] }) {
  const total = categorias.reduce((s, c) => s + c.valor, 0);
  // Até 5 categorias com nome; o resto vira "outras", para nenhum bloco ficar ilegível.
  const principais = categorias.slice(0, 5);
  const resto = categorias.slice(5).reduce((s, c) => s + c.valor, 0);
  const itens = [...principais, ...(resto > 0 ? [{ nome: 'Outras', valor: resto }] : [])].map((c, i) => ({ ...c, tom: TONS[Math.min(i, TONS.length - 1)]! }));
  const blocos = mosaico(itens, { x: 0, y: 0, w: 100, h: 100 });
  return (
    <div className="relative h-full min-h-44 w-full">
      {blocos.map((b, i) => {
        const pct = total > 0 ? Math.round((b.valor / total) * 100) : 0;
        const pequeno = b.w < 22 || b.h < 26;
        return (
          <div
            key={b.nome}
            title={`${b.nome}: ${pct}%`}
            className={`grafico-surge absolute overflow-hidden rounded-xl p-2.5 ${b.tom}`}
            style={{
              left: `calc(${b.x}% + 2px)`,
              top: `calc(${b.y}% + 2px)`,
              width: `calc(${b.w}% - 4px)`,
              height: `calc(${b.h}% - 4px)`,
              animationDelay: `${i * 60}ms`,
            }}
          >
            {!pequeno && <p className="truncate text-[11px] font-medium leading-tight">{b.nome}</p>}
            <p className="text-xs font-bold tabular leading-tight">{pct}%</p>
          </div>
        );
      })}
    </div>
  );
}

// ── Calendário do caixa ─────────────────────────────────────────────────────
export function CalendarioDoCaixa({ mes, dias, hoje }: { mes: string; dias: { entra: number; sai: number }[]; hoje: string }) {
  const [y, m] = mes.split('-').map(Number) as [number, number];
  const primeiro = new Date(y, m - 1, 1).getDay(); // 0 = domingo
  const max = Math.max(1, ...dias.map((d) => Math.max(d.entra, d.sai)));
  const semana = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  const diaDeHoje = hoje.slice(0, 7) === mes ? Number(hoje.slice(8, 10)) : null;
  return (
    <div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {semana.map((s, i) => (
          <span key={i} className="rotulo text-ink-soft">
            {s}
          </span>
        ))}
        {Array.from({ length: primeiro }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {dias.map((d, i) => {
          const n = i + 1;
          const liquido = d.entra - d.sai;
          const forca = Math.max(d.entra, d.sai) / max;
          const vazio = d.entra === 0 && d.sai === 0;
          const cor = liquido >= 0 ? ESMERALDA : ROSA;
          const titulo = vazio
            ? `Dia ${n}: nada vence`
            : `Dia ${n}: ${d.entra ? `entra ${compacto(d.entra)}` : ''}${d.entra && d.sai ? ' · ' : ''}${d.sai ? `sai ${compacto(d.sai)}` : ''}`;
          return (
            <div
              key={n}
              title={titulo}
              className={`grafico-surge relative h-9 rounded-lg sm:h-10 text-left ${vazio ? 'bg-black/[0.04] dark:bg-white/[0.05]' : ''} ${
                n === diaDeHoje ? 'ring-2 ring-ink ring-offset-1 ring-offset-transparent' : ''
              }`}
              style={{
                ...(vazio ? {} : { backgroundColor: cor, opacity: 0.28 + forca * 0.72 }),
                animationDelay: `${i * 12}ms`,
              }}
            >
              <span className={`absolute left-1.5 top-1 text-[10px] font-semibold ${vazio ? 'text-ink-soft' : 'text-black/70'}`}>{n}</span>
              {d.entra > 0 && d.sai > 0 && <span className="absolute bottom-1 right-1.5 h-1.5 w-1.5 rounded-full bg-black/40" title="entra e sai no mesmo dia" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Barras radiais (quem comprou) ───────────────────────────────────────────
export function BarrasRadiais({ fatias }: { fatias: { rotulo: string; fracao: number }[] }) {
  const cores = [ESMERALDA, '#6ee7b7', '#a7f3d0', 'rgba(127,127,127,.35)'];
  return (
    <svg viewBox="0 0 120 120" className="w-full text-black/[0.06] dark:text-white/[0.07]" role="img" aria-label="Participação dos maiores clientes">
      {fatias.slice(0, 4).map((f, i) => {
        const r = 52 - i * 12;
        const c = 2 * Math.PI * r;
        const volta = 0.75; // três quartos de volta = 100%
        const frac = Math.max(0, Math.min(1, f.fracao));
        return (
          <g key={i}>
            <circle cx="60" cy="60" r={r} fill="none" stroke="currentColor" strokeWidth="8" strokeDasharray={`${c * volta} ${c}`} strokeLinecap="round" transform="rotate(-90 60 60)" />
            {frac > 0.003 && (
              <circle
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={cores[i]}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${c * volta * frac} ${c}`}
                transform="rotate(-90 60 60)"
                className="grafico-gira"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <title>{`${f.rotulo}: ${Math.round(frac * 100)}%`}</title>
              </circle>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Régua das faixas do Simples ─────────────────────────────────────────────
const LIMITES = [180_000, 360_000, 720_000, 1_800_000, 3_600_000, 4_800_000];

export function ReguaDoSimples({ faixa, dentro }: { faixa: number; dentro: number }) {
  const W = 600;
  const seg = W / 6;
  const pos = (faixa - 1) * seg + Math.max(0.02, Math.min(0.98, dentro)) * seg;
  return (
    <svg viewBox={`0 -26 ${W} 74`} className="w-full overflow-visible text-black/[0.08] dark:text-white/[0.1]" role="img" aria-label={`Faixa ${faixa} do Simples Nacional`}>
      {LIMITES.map((lim, i) => {
        const x = i * seg;
        const passada = i + 1 < faixa;
        const atual = i + 1 === faixa;
        return (
          <g key={lim}>
            <rect x={x + 2} y="0" width={seg - 4} height="10" rx="5" fill={passada ? ESMERALDA : 'currentColor'} fillOpacity={passada ? 0.45 : 1} />
            {atual && <rect x={x + 2} y="0" width={Math.max(0, pos - x - 2)} height="10" rx="5" fill={ESMERALDA} className="grafico-surge" />}
            <text x={x + seg / 2} y="30" textAnchor="middle" fontSize="11" className={atual ? 'fill-ink font-semibold' : 'fill-ink-soft'}>
              {i + 1}ª · até {compacto(lim)}
            </text>
          </g>
        );
      })}
      <g className="grafico-surge">
        <circle cx={pos} cy="5" r="9" fill={LIMAO} stroke="#0A0D0B" strokeWidth="2.5" />
        <text x={Math.max(18, Math.min(W - 18, pos))} y="-12" textAnchor="middle" fontSize="11" fontWeight="700" className="fill-ink">
          você
        </text>
      </g>
    </svg>
  );
}
