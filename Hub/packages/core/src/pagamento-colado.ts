/**
 * LER O QUE O CLIENTE COLA: BOLETO OU PIX.
 *
 * Lançar uma conta a pagar pelo formulário é digitar o que já está escrito no
 * boleto. A linha digitável e o "Pix copia e cola" carregam valor, vencimento
 * e quem recebe, em formatos públicos e determinísticos — dá para ler sem
 * adivinhar. O que o código não traz (a descrição, a categoria) a pessoa
 * completa.
 *
 * Três formatos:
 *   - boleto bancário: linha digitável de 47 dígitos (ou código de barras de 44);
 *   - arrecadação/convênio (contas de consumo, tributos): começa com 8,
 *     48 dígitos na linha (ou 44 no código de barras);
 *   - Pix: o BR Code (EMV) do copia e cola, que começa com "000201".
 */

export type TipoDoPagamento = 'BOLETO' | 'CONVENIO' | 'PIX';

export interface PagamentoLido {
  tipo: TipoDoPagamento;
  /** Em reais; null quando o código não traz valor (Pix sem valor, convênio por referência). */
  valor: number | null;
  /** AAAA-MM-DD; null quando o código não informa. */
  vencimento: string | null;
  /** Quem recebe: banco emissor (boleto), segmento (convênio) ou nome do recebedor (Pix). */
  favorecido: string | null;
  /** Descrição sugerida para o lançamento. */
  sugestao: string;
}

const BANCOS: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '041': 'Banrisul',
  '077': 'Banco Inter',
  '104': 'Caixa',
  '208': 'BTG Pactual',
  '212': 'Banco Original',
  '237': 'Bradesco',
  '260': 'Nubank',
  '290': 'PagBank',
  '323': 'Mercado Pago',
  '336': 'C6 Bank',
  '341': 'Itaú',
  '422': 'Safra',
  '461': 'Asaas',
  '748': 'Sicredi',
  '756': 'Sicoob',
};

/** Segmento do convênio (2º dígito do código de barras). */
const SEGMENTOS: Record<string, string> = {
  '1': 'Prefeitura',
  '2': 'Saneamento',
  '3': 'Energia elétrica e gás',
  '4': 'Telecomunicações',
  '5': 'Órgão governamental',
  '6': 'Carnê ou assemelhado',
  '7': 'Multa de trânsito',
  '9': 'Convênio',
};

const DIA = 86_400_000;

function data(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Fator de vencimento do boleto: dias desde 07/10/1997. Chegou a 9999 em
 * 21/02/2025 e reiniciou em 1000 a partir de 22/02/2025. O mesmo fator vale
 * para as duas eras; fica a data mais próxima de hoje.
 */
export function vencimentoDoFator(fator: number, hoje = new Date()): string | null {
  if (!fator) return null;
  const antiga = new Date(Date.UTC(1997, 9, 7) + fator * DIA);
  const nova = new Date(Date.UTC(2025, 1, 22) + (fator - 1000) * DIA);
  const perto = (d: Date) => Math.abs(d.getTime() - hoje.getTime());
  return data(fator >= 1000 && perto(nova) < perto(antiga) ? nova : antiga);
}

function valorEmCentavos(digitos: string): number | null {
  const n = Number(digitos);
  return Number.isFinite(n) && n > 0 ? n / 100 : null;
}

/** Linha digitável (47) → código de barras (44) do boleto bancário. */
function barrasDoBoleto(linha: string): string {
  return linha.slice(0, 4) + linha.slice(32, 33) + linha.slice(33, 47) + linha.slice(4, 9) + linha.slice(10, 20) + linha.slice(21, 31);
}

function lerBoleto(barras: string, hoje: Date): PagamentoLido {
  const banco = BANCOS[barras.slice(0, 3)] ?? `Banco ${barras.slice(0, 3)}`;
  const valor = valorEmCentavos(barras.slice(9, 19));
  const vencimento = vencimentoDoFator(Number(barras.slice(5, 9)), hoje);
  return { tipo: 'BOLETO', valor, vencimento, favorecido: banco, sugestao: `Boleto ${banco}` };
}

function lerConvenio(barras: string): PagamentoLido {
  // 3º dígito: 6 ou 8 = valor efetivo em reais; 7 ou 9 = valor de referência.
  const efetivo = barras[2] === '6' || barras[2] === '8';
  const valor = efetivo ? valorEmCentavos(barras.slice(4, 15)) : null;
  const segmento = SEGMENTOS[barras[1] ?? ''] ?? 'Convênio';
  return { tipo: 'CONVENIO', valor, vencimento: null, favorecido: segmento, sugestao: `Conta de ${segmento.toLowerCase()}` };
}

/** Lê os campos TLV do BR Code (id de 2 dígitos, tamanho de 2, valor). */
function camposEmv(texto: string): Map<string, string> {
  const campos = new Map<string, string>();
  let i = 0;
  while (i + 4 <= texto.length) {
    const id = texto.slice(i, i + 2);
    const tamanho = Number(texto.slice(i + 2, i + 4));
    if (!Number.isFinite(tamanho)) break;
    campos.set(id, texto.slice(i + 4, i + 4 + tamanho));
    i += 4 + tamanho;
  }
  return campos;
}

function lerPix(texto: string): PagamentoLido {
  const c = camposEmv(texto);
  const valor = c.has('54') ? Number(c.get('54')) : null;
  const nome = c.get('59')?.trim() || null;
  const cidade = c.get('60')?.trim();
  return {
    tipo: 'PIX',
    valor: valor && Number.isFinite(valor) && valor > 0 ? valor : null,
    vencimento: null,
    favorecido: nome,
    sugestao: nome ? `Pix para ${nome}${cidade ? ` (${cidade})` : ''}` : 'Pagamento via Pix',
  };
}

/**
 * Lê o que foi colado. Devolve null quando não é boleto nem Pix — quem chama
 * cai no formulário normal.
 */
export function lerPagamentoColado(colado: string, hoje = new Date()): PagamentoLido | null {
  const bruto = colado.trim();
  if (!bruto) return null;
  if (bruto.startsWith('000201')) return lerPix(bruto);

  const d = bruto.replace(/\D/g, '');
  if (d.length === 48 && d[0] === '8') {
    // 4 blocos de 11 dígitos + 1 dígito verificador cada.
    const barras = [0, 12, 24, 36].map((i) => d.slice(i, i + 11)).join('');
    return lerConvenio(barras);
  }
  if (d.length === 44 && d[0] === '8') return lerConvenio(d);
  if (d.length === 47) return lerBoleto(barrasDoBoleto(d), hoje);
  if (d.length === 44) return lerBoleto(d, hoje);
  return null;
}
