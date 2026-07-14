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
  status: 'ISSUING' | 'ISSUED' | 'ERROR';
  pdfUrl?: string;
  xmlUrl?: string;
  errorMessage?: string;
}

export interface NfsePort {
  issue(input: NfseIssueInput): Promise<NfseIssueResult>;
  cancel(providerProtocol: string, reason: string): Promise<void>;
  /** Consulta status (usado por webhook/polling). */
  getStatus(providerProtocol: string): Promise<NfseIssueResult>;
  /** Retorna o buffer do XML (gz/base64 decodificado) ou do PDF. */
  download?(providerProtocol: string, type: 'xml' | 'pdf'): Promise<Buffer>;
}
