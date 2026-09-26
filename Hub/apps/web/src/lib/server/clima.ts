import 'server-only';
import { withTenant, sql } from '@hexxa/db';
import type { TenantContext } from '@hexxa/core';

/**
 * A temperatura agora na cidade da empresa (Open-Meteo: gratuito, sem chave).
 * Guardado por 30 minutos; qualquer falha devolve null e o cabeçalho segue
 * sem a temperatura.
 */

const DESCRICAO: [number[], string][] = [
  [[0], 'céu limpo'],
  [[1, 2], 'poucas nuvens'],
  [[3], 'nublado'],
  [[45, 48], 'neblina'],
  [[51, 53, 55, 56, 57], 'garoa'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'chuva'],
  [[71, 73, 75, 77, 85, 86], 'neve'],
  [[95, 96, 99], 'tempestade'],
];

export async function climaDaEmpresa(ctx: TenantContext): Promise<{ temperatura: number; descricao: string; cidade: string } | null> {
  try {
    const [c] = (await withTenant(ctx.companyId, (tx) =>
      tx.execute(sql`SELECT city, state FROM company WHERE id = ${ctx.companyId}`),
    )) as unknown as { city: string | null; state: string | null }[];
    const cidade = c?.city?.trim();
    if (!cidade) return null;

    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cidade)}&count=5&language=pt&countryCode=BR`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(3000) },
    ).then((r) => r.json() as Promise<{ results?: { latitude: number; longitude: number; admin1?: string }[] }>);
    const lugar = geo.results?.find((r) => !c?.state || r.admin1?.toLowerCase().includes(estadoPorExtenso(c.state))) ?? geo.results?.[0];
    if (!lugar) return null;

    const tempo = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lugar.latitude}&longitude=${lugar.longitude}&current=temperature_2m,weather_code&timezone=America%2FSao_Paulo`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(3000) },
    ).then((r) => r.json() as Promise<{ current?: { temperature_2m: number; weather_code: number } }>);
    if (!tempo.current) return null;
    const codigo = tempo.current.weather_code;
    return {
      temperatura: Math.round(tempo.current.temperature_2m),
      descricao: DESCRICAO.find(([cs]) => cs.includes(codigo))?.[1] ?? '',
      cidade: cidade.replace(/\b\w/g, (l) => l.toUpperCase()).replace(/\B\w+/g, (w) => w.toLowerCase()),
    };
  } catch {
    return null;
  }
}

const UFS: Record<string, string> = {
  AC: 'acre', AL: 'alagoas', AP: 'amapá', AM: 'amazonas', BA: 'bahia', CE: 'ceará', DF: 'distrito federal', ES: 'espírito santo', GO: 'goiás',
  MA: 'maranhão', MT: 'mato grosso', MS: 'mato grosso do sul', MG: 'minas gerais', PA: 'pará', PB: 'paraíba', PR: 'paraná', PE: 'pernambuco',
  PI: 'piauí', RJ: 'rio de janeiro', RN: 'rio grande do norte', RS: 'rio grande do sul', RO: 'rondônia', RR: 'roraima', SC: 'santa catarina',
  SP: 'são paulo', SE: 'sergipe', TO: 'tocantins',
};
function estadoPorExtenso(uf: string) {
  return UFS[uf.trim().toUpperCase()] ?? uf.toLowerCase();
}
