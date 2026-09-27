/**
 * Tipos e helpers do DANFSe que são puros (sem I/O) e por isso podem ser
 * importados tanto pelo server (lib/server/danfse.ts, que faz o parse do
 * XML) quanto por componentes client (a tela de visualização). Ficam FORA
 * de lib/server/ de propósito — um arquivo com 'server-only' não pode ser
 * importado (nem por valor) de um Client Component.
 */

export interface DanfseEndereco {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
}

/** Valor no formato brasileiro: 1800 → "1.800,00". */
export const brl = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** CPF/CNPJ com pontuação (o CNPJ alfanumérico passa como veio). */
export function formatarDocumento(doc: string): string {
  const d = (doc ?? '').replace(/\D/g, '');
  if (d.length === 14 && d === doc.replace(/[.\/-]/g, '')) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc;
}

/** Endereço em uma linha, com o CEP pontuado. */
export function enderecoLinha(e: DanfseEndereco): string {
  const cep = e.cep?.replace(/\D/g, '');
  return [e.logradouro, e.numero, e.complemento, e.bairro, cep?.length === 8 ? `CEP ${cep.slice(0, 5)}-${cep.slice(5)}` : e.cep].filter(Boolean).join(', ') || '-';
}

export type RegimeTributario = 'MEI' | 'SIMPLES_NACIONAL' | 'NAO_OPTANTE';

export function regimeLabel(regime: RegimeTributario): string {
  switch (regime) {
    case 'MEI':
      return 'Optante — Microempreendedor Individual (MEI)';
    case 'SIMPLES_NACIONAL':
      return 'Optante — Simples Nacional (ME/EPP)';
    default:
      return 'Não optante pelo Simples Nacional';
  }
}
