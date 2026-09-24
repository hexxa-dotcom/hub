/**
 * Port de assinatura eletrônica. Implementações: Clicksign, D4Sign, ZapSign...
 * (packages/integrations/signature).
 */

export interface SignatureSigner {
  name: string;
  email: string;
  role?: string;
  /** false: não manda e-mail para este signatário (ele assina embutido na Hexx). */
  sendEmail?: boolean;
  /** Onde fica o campo de assinatura; `page: 'last'` = última página do PDF. */
  area?: { x: number; y: number; w: number; h: number; page: number | 'last' };
}

export interface SignatureCreateInput {
  /** URL pública do PDF (fornecedores que buscam o arquivo por HTTP). */
  documentUrl?: string;
  /** Conteúdo do PDF em base64 (fornecedores com upload direto, ex.: DocuSeal). */
  documentBuffer?: { base64: string; filename: string };
  title: string;
  signers: SignatureSigner[];
  /** Domínio do que está sendo assinado, sem acoplar ao fornecedor. */
  subject: { type: 'CONTRACT' | 'LEASE' | 'DOCUMENT'; id: string };
}

export interface SignatureEnvelope {
  providerEnvelopeId: string;
  status: 'PENDING' | 'SENT' | 'SIGNED' | 'REFUSED' | 'EXPIRED';
  signUrls: { email: string; url: string }[];
}

export interface SignaturePort {
  createEnvelope(input: SignatureCreateInput): Promise<SignatureEnvelope>;
  getEnvelope(providerEnvelopeId: string): Promise<SignatureEnvelope>;
  cancel(providerEnvelopeId: string): Promise<void>;
}
