/**
 * LER O EXTRATO DO PGDAS-D.
 *
 * ── Por que isto virou função pura ─────────────────────────────────────
 *
 * A leitura existia dentro de uma server action do contador, com as regex
 * soltas no meio da gravação no banco. Não tinha teste — e um parser de
 * documento fiscal sem teste é uma promessa: ele funciona no PDF que a pessoa
 * usou para escrevê-lo, e ninguém sabe o que faz no próximo.
 *
 * Extraída, ela serve aos dois lados: o contador continua importando o extrato
 * do cliente, e o cliente pode subir o dele no primeiro acesso em vez de
 * digitar o faturamento de cabeça.
 *
 * ── Por que o PGDAS e não o balanço ────────────────────────────────────
 *
 * Porque o extrato traz o RBT12 já calculado pela Receita — o mesmo número
 * que decide a faixa do Simples. Qualquer outra origem seria uma soma nossa
 * que poderia divergir da apuração oficial, e divergir para menos significa
 * calcular imposto a menos.
 *
 * ── Por que falha em vez de chutar ─────────────────────────────────────
 *
 * Campo que não for encontrado não recebe valor padrão. Um RBT12 assumido
 * como zero jogaria a empresa na primeira faixa do Simples e mostraria uma
 * alíquota que não é a dela. É melhor dizer "não consegui ler" e pedir o
 * número à mão.
 */

export interface ExtratoPgdas {
  /** Receita bruta dos 12 meses anteriores, como a Receita calculou. */
  rbt12: number;
  /** Alíquota efetiva em pontos percentuais (6,54 = 6,54%). */
  aliquotaEfetiva: number | null;
  /** Receita do próprio período de apuração. */
  receitaDoPeriodo: number | null;
  /** 'Anexo III', 'Anexo V'… */
  anexo: string | null;
  /** Período de apuração, AAAA-MM. */
  competencia: string | null;
}

export interface LeituraDoPgdas {
  ok: boolean;
  /** Preenchido quando `ok`. */
  extrato: ExtratoPgdas | null;
  /** Por que não deu, em português, quando não deu. */
  motivo: string | null;
}

/** "1.234.567,89" → 1234567.89. Devolve NaN no que não for número. */
function valor(texto: string | undefined): number {
  if (!texto) return NaN;
  return Number(texto.replace(/\./g, '').replace(',', '.'));
}

/**
 * Tenta várias grafias do mesmo campo.
 *
 * O extrato mudou de layout mais de uma vez, e o mesmo número aparece como
 * "RBT12", "RBA12" ou "Receita Bruta Acumulada" conforme a versão e a seção.
 * Uma regex só funcionaria no PDF de quem a escreveu.
 */
function primeiroQueCasar(texto: string, padroes: RegExp[]): string | undefined {
  for (const p of padroes) {
    const m = p.exec(texto);
    if (m?.[1]) return m[1];
  }
  return undefined;
}

export function lerExtratoPgdas(texto: string): LeituraDoPgdas {
  if (!/PGDAS|Simples Nacional/i.test(texto)) {
    return {
      ok: false,
      extrato: null,
      motivo: 'Este arquivo não parece um extrato do Simples Nacional (PGDAS-D).',
    };
  }

  const rbt12 = valor(
    primeiroQueCasar(texto, [
      /RBT12[^\d]{0,40}?([\d.]+,\d{2})/i,
      /RBA12[^\d]{0,40}?([\d.]+,\d{2})/i,
      /Receita Bruta (?:Acumulada|Total)[^\d]{0,60}?([\d.]+,\d{2})/i,
    ]),
  );

  if (!Number.isFinite(rbt12)) {
    return {
      ok: false,
      extrato: null,
      motivo:
        'Não encontrei a receita bruta dos últimos 12 meses (RBT12) no arquivo. Informe o valor à mão.',
    };
  }

  const aliquota = valor(
    primeiroQueCasar(texto, [
      /Al[íi]quota\s+Efetiva[^\d]{0,30}?(\d{1,2},\d{2})/i,
      /Al[íi]quota[^\d]{0,30}?(?:efetiva|nominal)[^\d]{0,20}?(\d{1,2},\d{2})/i,
    ]),
  );

  const receitaDoPeriodo = valor(
    primeiroQueCasar(texto, [
      /Receita Bruta do PA[^\d]{0,40}?([\d.]+,\d{2})/i,
      /\(RPA\)[^\d]{0,40}?([\d.]+,\d{2})/i,
    ]),
  );

  const pa = /Per[íi]odo de Apura[çc][ãa]o[^\d]{0,20}?(\d{2})\/(\d{4})/i.exec(texto);
  const anexo = /Anexo\s+(I{1,3}|IV|V)\b/i.exec(texto)?.[1];

  return {
    ok: true,
    motivo: null,
    extrato: {
      rbt12,
      aliquotaEfetiva: Number.isFinite(aliquota) ? aliquota : null,
      receitaDoPeriodo: Number.isFinite(receitaDoPeriodo) ? receitaDoPeriodo : null,
      anexo: anexo ? `Anexo ${anexo.toUpperCase()}` : null,
      competencia: pa ? `${pa[2]}-${pa[1]}` : null,
    },
  };
}
