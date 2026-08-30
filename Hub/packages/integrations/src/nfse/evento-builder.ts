/**
 * Montagem do XML do Pedido de Registro de Evento (pedRegEvento) — evento de
 * Cancelamento de NFS-e (e101101), Padrão Nacional NFS-e v1.01.
 *
 * Layout conforme Manual de Integração v1.01 (seção 10.4 "Eventos", tabela
 * D-1 a D-10) e o identificador TSIdPedRefEvt: "PRE" + chave de acesso (50) +
 * tipo do evento (6) — sem sequencial, diferente do TSIdEvento de resposta.
 */

import { normalizeDocument } from '@hexxa/core/document-br';

const onlyDigits = (s: string) => (s ?? '').replace(/\D/g, '');

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function nowBrasilia(): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const brt = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return (
    `${brt.getUTCFullYear()}-${pad(brt.getUTCMonth() + 1)}-${pad(brt.getUTCDate())}` +
    `T${pad(brt.getUTCHours())}:${pad(brt.getUTCMinutes())}:${pad(brt.getUTCSeconds())}-03:00`
  );
}

/** Código de justificativa de cancelamento (evento e101101), tabela D-9c. */
export type CancelamentoMotivo = '1' | '2' | '9'; // 1=Erro na Emissão; 2=Serviço não Prestado; 9=Outros

const TIPO_EVENTO_CANCELAMENTO = '101101';

export interface CancelamentoEventoParams {
  ambiente: 'homologacao' | 'producao';
  /** Chave de acesso da NFS-e a ser cancelada (50 dígitos). */
  chaveAcesso: string;
  /** CNPJ do autor do evento (emitente). */
  cnpjAutor: string;
  motivo: CancelamentoMotivo;
  justificativa: string;
}

export interface BuiltEvento {
  xml: string;
  refId: string;
}

/** Deriva o cMotivo (e101101) a partir de um texto livre de justificativa. */
export function inferCancelamentoMotivo(reason: string): CancelamentoMotivo {
  const r = reason.toLowerCase();
  if (r.includes('não prestado') || r.includes('nao prestado') || r.includes('serviço não') || r.includes('servico nao')) {
    return '2';
  }
  if (r.includes('erro')) return '1';
  return '9';
}

/** Constrói o XML do pedRegEvento de cancelamento (sem assinatura). */
export function buildCancelamentoEvento(params: CancelamentoEventoParams): BuiltEvento {
  const tpAmb = params.ambiente === 'producao' ? '1' : '2';
  const chave = onlyDigits(params.chaveAcesso).padStart(50, '0').slice(0, 50) || params.chaveAcesso;
  // normalizeDocument PRESERVA letras — CNPJ alfanumérico (obrigatório pra
  // novos CNPJs a partir de jul/2026) não pode passar por onlyDigits.
  const cnpjAutor = normalizeDocument(params.cnpjAutor).padStart(14, '0');

  // TSIdPedRefEvt: "PRE" + chave de acesso (50) + tipo do evento (6)
  const refId = `PRE${chave}${TIPO_EVENTO_CANCELAMENTO}`;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">` +
    `<infPedReg Id="${refId}">` +
    `<tpAmb>${tpAmb}</tpAmb>` +
    `<verAplic>hexx-hub-digital-1.0</verAplic>` +
    `<dhEvento>${nowBrasilia()}</dhEvento>` +
    `<CNPJAutor>${cnpjAutor}</CNPJAutor>` +
    `<chNFSe>${chave}</chNFSe>` +
    `<nPedRegEvento>1</nPedRegEvento>` +
    `<e101101>` +
    `<xDesc>Cancelamento de NFS-e</xDesc>` +
    `<cMotivo>${params.motivo}</cMotivo>` +
    `<xMotivo>${escapeXml(params.justificativa.slice(0, 255))}</xMotivo>` +
    `</e101101>` +
    `</infPedReg>` +
    `</pedRegEvento>`;

  return { xml, refId };
}
