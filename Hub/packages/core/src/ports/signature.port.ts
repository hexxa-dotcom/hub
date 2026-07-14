/**
 * Port de assinatura eletrônica. Implementações: Clicksign, D4Sign, ZapSign...
 * (packages/integrations/signature).
 */

export interface SignatureSigner {
  name: string;
  email: string;
  role?: string;
}

export interface SignatureCreateInput {
  documentUrl: string;
  title: string;
  signers: SignatureSigner[];
  /** Domínio do que está sendo assinado, sem acoplar ao fornecedor. */
  subject: { type: 'CONTRACT' | 'LEASE'; id: string };
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
