/**
 * GRÁFICOS DA INÍCIO — desenhados à mão em SVG, leves, sem biblioteca.
 *
 * Cada área da Início tem um desenho próprio (área suave, anel, meia-lua,
 * anéis concêntricos, fluxo, arco dividido, bolhas, donut em fatias, espiral,
 * funil em círculos, linha do tempo) para a tela não virar uma fileira de
 * barras iguais. As cores seguem o sistema: verde-limão para o principal,
 * esmeralda para entrada, rosa para saída ou atraso, âmbar para atenção.
 *
 * Todos entram com um "desenhar" curto (ver .grafico-* no globals.css) e
 * respeitam o movimento reduzido.
 */

const LIMAO = '#D4FF00';
const ESMERALDA = '#34d399';
const ROSA = '#fb7185';
const TRILHO = 'currentColor';

/** Caminho suave (curvas de Bézier) passando pelos pontos. */
function suave(pts: [number, number][]) {
  if (!pts.length) return '';
  let d = `M${pts[0]![0]},${pts[0]![1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

/** Arco de meia-volta (0 a 1, da esquerda para a direita). */
function arco(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(Math.PI * (1 - a)), cy - r * Math.sin(Math.PI * (1 - a))];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0},${y0} A${r},${r} 0 0 1 ${x1},${y1}`;
}

// ── Área suave de 12 meses ──────────────────────────────────────────────────
export function AreaSuave({ valores, id = 'area' }: { valores: number[]; id?: string }) {
  const W = 300;
  const H = 110;
  const max = Math.max(1, ...valores);
  const pts = valores.map((v, i) => [(i * W) / Math.max(1, valores.length - 1), H - 8 - (v / max) * (H - 22)] as [number, number]);
  const linha = suave(pts);
  const ultimo = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" role="img" aria-label="Faturamento dos últimos 12 meses">
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={LIMAO} stopOpacity="0.32" />
          <stop offset="1" stopColor={LIMAO} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${linha} L${W},${H} L0,${H} Z`} fill={`url(#${id}-g)`} className="grafico-surge" />
      <path d={linha} fill="none" stroke={LIMAO} strokeWidth="2.2" strokeLinecap="round" pathLength={1} className="grafico-desenha" />
      {ultimo && (
        <>
          <circle cx={ultimo[0] - 1} cy={ultimo[1]} r="9" fill={LIMAO} opacity="0.18" className="grafico-surge" />
          <circle cx={ultimo[0] - 1} cy={ultimo[1]} r="4.5" fill={LIMAO} className="grafico-surge" />
        </>
      )}
    </svg>
  );
}

// ── Anel (porcentagem) ──────────────────────────────────────────────────────
export function Anel({ fracao, cor = ESMERALDA, rotulo }: { fracao: number; cor?: string; rotulo: string }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <svg viewBox="0 0 100 100" className="w-full text-black/[0.07] dark:text-white/[0.08]" role="img" aria-label={rotulo}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={TRILHO} strokeWidth="9" />
      {f > 0.005 && (
        <circle cx="50" cy="50" r={r} fill="none" stroke={cor} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${c * f} ${c}`} transform="rotate(-90 50 50)" className="grafico-gira" />
      )}
      <text x="50" y="56" textAnchor="middle" className="fill-ink" fontSize="17" fontWeight="700">
        {rotulo}
      </text>
    </svg>
  );
}

// ── Pontos de tendência ─────────────────────────────────────────────────────
export function PontosTendencia({ valores }: { valores: number[] }) {
  const max = Math.max(1, ...valores);
  const min = Math.min(...valores, 0);
  const passo = 112 / Math.max(1, valores.length - 1);
  return (
    <svg viewBox="0 0 120 28" className="w-full text-ink" role="img" aria-label="Tendência">
      {valores.map((v, i) => {
        const ultimo = i === valores.length - 1;
        return (
          <circle
            key={i}
            cx={4 + i * passo}
            cy={24 - ((v - min) / Math.max(1, max - min)) * 20}
            r={ultimo ? 3.6 : 2.4}
            fill={ultimo ? LIMAO : 'currentColor'}
            opacity={ultimo ? 1 : 0.3}
            className="grafico-surge"
            style={{ animationDelay: `${i * 40}ms` }}
          />
        );
      })}
    </svg>
  );
}

// ── Meia-lua (pago x aberto) ────────────────────────────────────────────────
export function MeiaLua({ fracao, rotulo }: { fracao: number; rotulo: string }) {
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <svg viewBox="0 0 120 66" className="w-full text-black/[0.07] dark:text-white/[0.08]" role="img" aria-label={rotulo}>
      <path d={arco(60, 60, 48, 0, 1)} fill="none" stroke={TRILHO} strokeWidth="10" strokeLinecap="round" />
      {f > 0.005 && <path d={arco(60, 60, 48, 0, f)} fill="none" className="grafico-desenha stroke-ink" strokeWidth="10" strokeLinecap="round" pathLength={1} />}
      <text x="60" y="58" textAnchor="middle" className="fill-ink" fontSize="15" fontWeight="700">
        {rotulo}
      </text>
    </svg>
  );
}

// ── Anéis concêntricos (atraso por faixa) ───────────────────────────────────
export function AneisConcentricos({ faixas }: { faixas: { valor: number; cor: string }[] }) {
  const total = Math.max(1, ...faixas.map((f) => f.valor));
  return (
    <svg viewBox="0 0 100 100" className="w-full text-black/[0.07] dark:text-white/[0.06]" role="img" aria-label="Atraso por faixa">
      {faixas.map((f, i) => {
        const r = 42 - i * 10;
        const c = 2 * Math.PI * r;
        const fr = f.valor / total;
        return (
          <g key={i}>
            <circle cx="50" cy="50" r={r} fill="none" stroke={TRILHO} strokeWidth="7" />
            {fr > 0 && (
              <circle
                cx="50"
                cy="50"
                r={r}
                fill="none"
                stroke={f.cor}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${c * fr} ${c}`}
                transform="rotate(-90 50 50)"
                className="grafico-gira"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Fluxo dos próximos dias (entra em cima, sai embaixo) ────────────────────
export function Fluxo({ entradas, saidas }: { entradas: number[]; saidas: number[] }) {
  const W = 600;
  const meio = 36;
  const max = Math.max(1, ...entradas, ...saidas);
  const k = 30 / max;
  const n = Math.max(entradas.length, 2);
  const curva = (v: number[], sinal: 1 | -1) => suave(v.map((y, i) => [(i * W) / (n - 1), meio - sinal * y * k] as [number, number]));
  const temEntrada = entradas.some((v) => v > 0);
  const temSaida = saidas.some((v) => v > 0);
  return (
    <svg viewBox={`0 0 ${W} 72`} className="w-full text-black/[0.1] dark:text-white/[0.12]" preserveAspectRatio="none" role="img" aria-label="Entradas e saídas dos próximos dias">
      {temEntrada && (
        <>
          <path d={`${curva(entradas, 1)} L${W},${meio} L0,${meio} Z`} fill="rgba(212,255,0,.24)" className="grafico-surge" />
          <path d={curva(entradas, 1)} fill="none" stroke={LIMAO} strokeWidth="1.6" vectorEffect="non-scaling-stroke" pathLength={1} className="grafico-desenha" />
        </>
      )}
      {temSaida && (
        <>
          <path d={`${curva(saidas, -1)} L${W},${meio} L0,${meio} Z`} fill="rgba(251,113,133,.2)" className="grafico-surge" />
          <path d={curva(saidas, -1)} fill="none" stroke={ROSA} strokeWidth="1.6" vectorEffect="non-scaling-stroke" pathLength={1} className="grafico-desenha" />
        </>
      )}
      <line x1="0" x2={W} y1={meio} y2={meio} stroke="currentColor" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Arco dividido (a receber x a pagar) ─────────────────────────────────────
export function ArcoDividido({ a, b, centro, sub }: { a: number; b: number; centro: string; sub: string }) {
  const total = a + b;
  const f = total > 0 ? a / total : 0.5;
  const folga = total > 0 && a > 0 && b > 0 ? 0.015 : 0;
  return (
    <svg viewBox="0 0 200 120" className="w-full text-black/[0.07] dark:text-white/[0.08]" role="img" aria-label={`${centro} ${sub}`}>
      {total === 0 && <path d={arco(100, 106, 86, 0, 1)} fill="none" stroke={TRILHO} strokeWidth="16" strokeLinecap="round" />}
      {a > 0 && <path d={arco(100, 106, 86, 0, f - folga)} fill="none" stroke={ESMERALDA} strokeWidth="16" strokeLinecap="round" pathLength={1} className="grafico-desenha" />}
      {b > 0 && <path d={arco(100, 106, 86, f + folga, 1)} fill="none" stroke={ROSA} strokeWidth="16" strokeLinecap="round" pathLength={1} className="grafico-desenha" style={{ animationDelay: '120ms' }} />}
      <text x="100" y="90" textAnchor="middle" className="fill-ink" fontSize="23" fontWeight="700">
        {centro}
      </text>
      <text x="100" y="106" textAnchor="middle" className="fill-ink-soft" fontSize="10">
        {sub}
      </text>
    </svg>
  );
}

// ── Medidor pequeno (alíquota) ──────────────────────────────────────────────
export function Medidor({ fracao, rotulo }: { fracao: number; rotulo: string }) {
  const f = Math.max(0, Math.min(1, fracao));
  return (
    <svg viewBox="0 0 100 60" className="w-full text-black/[0.07] dark:text-white/[0.08]" role="img" aria-label={rotulo}>
      <path d={arco(50, 52, 40, 0, 1)} fill="none" stroke={TRILHO} strokeWidth="6" strokeLinecap="round" />
      {f > 0.005 && <path d={arco(50, 52, 40, 0, f)} fill="none" stroke={LIMAO} strokeWidth="6" strokeLinecap="round" pathLength={1} className="grafico-desenha" />}
      <text x="50" y="50" textAnchor="middle" className="fill-ink" fontSize="16" fontWeight="700">
        {rotulo}
      </text>
    </svg>
  );
}

// ── Bolhas na linha do mês (notas) ──────────────────────────────────────────
export function BolhasDoMes({ pontos, diasNoMes }: { pontos: { dia: number; valor: number }[]; diasNoMes: number }) {
  const max = Math.max(1, ...pontos.map((p) => p.valor));
  return (
    <svg viewBox="0 0 300 50" className="w-full text-black/[0.12] dark:text-white/[0.14]" role="img" aria-label="Notas do mês por dia">
      <line x1="6" x2="294" y1="26" y2="26" stroke="currentColor" />
      {pontos.map((p, i) => (
        <circle
          key={i}
          cx={6 + ((p.dia - 1) / Math.max(1, diasNoMes - 1)) * 288}
          cy="26"
          r={3 + (p.valor / max) * 11}
          fill="rgba(212,255,0,.22)"
          stroke={LIMAO}
          strokeWidth="1"
          className="grafico-surge"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
    </svg>
  );
}

// ── Donut em fatias (documentos) ────────────────────────────────────────────
export function DonutFatias({ cores, centro }: { cores: string[]; centro: string }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const seg = c / Math.max(1, cores.length);
  return (
    <svg viewBox="0 0 100 100" className="w-full" role="img" aria-label={centro}>
      {cores.map((cor, i) => (
        <circle
          key={i}
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={cor}
          strokeWidth="11"
          strokeDasharray={`${seg - 4} ${c}`}
          strokeDashoffset={-i * seg}
          transform="rotate(-90 50 50)"
          className="grafico-surge"
          style={{ animationDelay: `${i * 50}ms` }}
        />
      ))}
      <text x="50" y="56" textAnchor="middle" className="fill-ink" fontSize="17" fontWeight="700">
        {centro}
      </text>
    </svg>
  );
}

// ── Espiral do ano ──────────────────────────────────────────────────────────
export function EspiralDoAno({ valores }: { valores: number[] }) {
  const max = Math.max(1, ...valores);
  const n = valores.length;
  return (
    <svg viewBox="0 0 120 120" className="w-full" role="img" aria-label="Faturamento dos últimos 12 meses em espiral">
      {valores.map((v, i) => {
        const ang = -Math.PI / 2 + (i * 2 * Math.PI) / n;
        const r0 = 16 + i * 1.6;
        const r1 = r0 + 5 + (v / max) * 30;
        const ultimo = i === n - 1;
        return (
          <line
            key={i}
            x1={60 + r0 * Math.cos(ang)}
            y1={60 + r0 * Math.sin(ang)}
            x2={60 + r1 * Math.cos(ang)}
            y2={60 + r1 * Math.sin(ang)}
            stroke={LIMAO}
            strokeOpacity={ultimo ? 1 : 0.16 + (i / n) * 0.55}
            strokeWidth="7"
            strokeLinecap="round"
            className="grafico-surge"
            style={{ animationDelay: `${i * 35}ms` }}
          />
        );
      })}
      <text x="60" y="64" textAnchor="middle" className="fill-ink" fontSize="11" fontWeight="700">
        12m
      </text>
    </svg>
  );
}

// ── Funil em círculos (propostas) ───────────────────────────────────────────
export function FunilCirculos({ etapas }: { etapas: { rotulo: string; n: number }[] }) {
  const max = Math.max(1, ...etapas.map((e) => e.n));
  return (
    <svg viewBox="0 0 140 50" className="w-full" role="img" aria-label="Funil de propostas">
      {etapas.map((e, i) => {
        const x = 20 + i * 44;
        const r = 6 + (e.n / max) * 9;
        return (
          <g key={e.rotulo} className="grafico-surge" style={{ animationDelay: `${i * 70}ms` }}>
            <circle cx={x} cy="19" r={r} fill="rgba(212,255,0,.12)" stroke="rgba(212,255,0,.6)" strokeWidth="1" />
            <text x={x} y="23" textAnchor="middle" className="fill-ink" fontSize="11" fontWeight="700">
              {e.n}
            </text>
            <text x={x} y="46" textAnchor="middle" className="fill-ink-soft" fontSize="8">
              {e.rotulo}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Linha do tempo de vencimentos (contratos) ───────────────────────────────
export function LinhaDoTempo({ pontos }: { pontos: { fracao: number; cor: string; titulo: string }[] }) {
  return (
    <svg viewBox="0 0 140 32" className="w-full text-black/[0.12] dark:text-white/[0.14]" role="img" aria-label="Quando os contratos terminam">
      <line x1="4" x2="136" y1="14" y2="14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      {pontos.map((p, i) => (
        <circle key={i} cx={4 + Math.max(0, Math.min(1, p.fracao)) * 132} cy="14" r="4" fill={p.cor} className="grafico-surge" style={{ animationDelay: `${i * 50}ms` }}>
          <title>{p.titulo}</title>
        </circle>
      ))}
      <text x="4" y="30" className="fill-ink-soft" fontSize="7">
        hoje
      </text>
      <text x="136" y="30" textAnchor="end" className="fill-ink-soft" fontSize="7">
        +12 meses
      </text>
    </svg>
  );
}
