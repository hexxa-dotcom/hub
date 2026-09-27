/**
 * Port de emissão de NFSe. O domínio depende DESTA interface, nunca de um
 * fornecedor concreto. As implementações vivem em packages/integrations/nfse.
 */

export interface NfseIssueInput {
  customer: {
    name: string;
    document: string;
    email?: string;
    address?: {
      cep: string;
      cMun: string;
      logradouro: string;
      numero: string;
      complemento?: string;
      bairro: string;
    };
  };
  amount: number;
  serviceDescription: string;
  /** mês de referência (NUNCA "competência") */
  referenceMonth: string; // YYYY-MM
  competenciaDate?: string; // YYYY-MM-DD
  retainIss?: boolean;
  /**
   * Carga total aproximada dos tributos, em % (Lei 12.741/2012). Para o
   * Simples é a alíquota efetiva do DAS. Sem ela, o XML usava 6% fixo de
   * tributos federais para qualquer empresa.
   */
  aliquotaTributosTotal?: number;
  /** Informações complementares (serv/infoCompl/xInfComp): pedido, dados de pagamento… */
  informacoesComplementares?: string;
  /**
   * IBS e CBS da nota (reforma tributária) — ver `ibsCbsDaNota`. Só entra no
   * XML quando o emitente liga o leiaute da reforma (`leiauteIbsCbs`).
   */
  ibsCbs?: { cst: string; cClassTrib: string; cIndOp: string; nbs?: string | null; consumoFinal?: boolean };
  serviceOverride?: {
    itemListaServico: string;
    codigoTributacaoMunicipio?: string;
    aliquotaIss?: number;
    cnae?: string;
  };
}

export interface NfseIssueResult {
  providerProtocol: string;
  nfseNumber?: string;
  status: 'ISSUING' | 'ISSUED' | 'ERROR' | 'CANCELED';
  pdfUrl?: string;
  xmlUrl?: string;
  errorMessage?: string;
  /** true quando veio do MockNfseAdapter (sem certificado configurado) — a UI
   *  precisa deixar isso visível, nunca mostrar como emissão real. */
  isMock?: boolean;
}

export interface NfsePort {
  issue(input: NfseIssueInput): Promise<NfseIssueResult>;
  /**
   * Cancela a nota. `motivo` é o código do evento: 1 = erro na emissão,
   * 2 = serviço não prestado, 9 = outros. Sem ele, deduz da justificativa.
   */
  cancel(providerProtocol: string, reason: string, motivo?: '1' | '2' | '9'): Promise<void>;
  /** Consulta status (usado por webhook/polling). */
  getStatus(providerProtocol: string): Promise<NfseIssueResult>;
  /** Retorna o buffer do XML (gz/base64 decodificado) ou do PDF. */
  download?(providerProtocol: string, type: 'xml' | 'pdf'): Promise<Buffer>;
}
