/** Tipos compartilhados entre as telas que enviam documentos para assinatura via DocuSeal. */

export type SignerInput = { name: string; email: string; role?: string };

export type SignatureRequestSummary = {
  id: string;
  title: string | null;
  signerName: string | null;
  signerEmail: string | null;
  status: 'PENDING' | 'SENT' | 'SIGNED' | 'REFUSED' | 'EXPIRED' | string;
  providerEnvelopeId: string | null;
  createdAt: string;
};
