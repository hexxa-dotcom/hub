/** As categorias dos Documentos da Empresa (ver 0075) — usadas no servidor e na tela. */

export type Categoria =
  | 'CONTRATO_SOCIAL'
  | 'CNPJ'
  | 'ALVARA'
  | 'CND_FEDERAL'
  | 'CND_ESTADUAL'
  | 'CND_MUNICIPAL'
  | 'CRF_FGTS'
  | 'SOCIOS'
  | 'CONTRATO'
  | 'CND'
  | 'OUTRO';

export const CATEGORIAS: Record<Categoria, string> = {
  CONTRATO_SOCIAL: 'Contrato social e alterações',
  CNPJ: 'Cartão CNPJ',
  ALVARA: 'Alvará de funcionamento',
  CND_FEDERAL: 'Certidão negativa federal',
  CND_ESTADUAL: 'Certidão negativa estadual',
  CND_MUNICIPAL: 'Certidão negativa municipal',
  CRF_FGTS: 'Certidão do FGTS (CRF)',
  SOCIOS: 'Documentos dos sócios',
  CONTRATO: 'Contratos',
  CND: 'Certidão negativa',
  OUTRO: 'Outros',
};

