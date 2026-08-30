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
