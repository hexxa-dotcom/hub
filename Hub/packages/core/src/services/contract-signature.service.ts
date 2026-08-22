/**
 * Envio de documentos para assinatura eletrônica — orquestração (ports only).
 * Liga: provedor de assinatura (port) + repositório de pedidos de assinatura.
 */
import type { SignaturePort, SignatureSigner } from '../ports/signature.port';
import type { SignatureRequestRepository, SignatureRequestRecord } from '../ports/repositories';
import type { TenantContext } from '../enums';

export interface SendForSignatureInput {
  title: string;
  documentBuffer: { base64: string; filename: string };
  signers: SignatureSigner[];
}

export interface ContractSignatureDeps {
  signature: SignaturePort;
  requests: SignatureRequestRepository;
}

export class ContractSignatureService {
  constructor(private readonly deps: ContractSignatureDeps) {}

  async send(ctx: TenantContext, input: SendForSignatureInput): Promise<{ id: string; status: string }> {
    if (!input.title.trim()) throw new Error('Informe um nome para o documento.');
    if (!input.signers.length) throw new Error('Adicione ao menos um signatário.');

    const primary = input.signers[0]!;
    const { id } = await this.deps.requests.create(ctx, {
      title: input.title,
      signerName: primary.name || primary.email,
      signerEmail: primary.email,
      subjectType: 'DOCUMENT',
      subjectId: crypto.randomUUID(),
    });

    try {
      const envelope = await this.deps.signature.createEnvelope({
        documentBuffer: input.documentBuffer,
        title: input.title,
        signers: input.signers,
        subject: { type: 'DOCUMENT', id },
      });
      await this.deps.requests.updateStatus(ctx, id, {
        status: envelope.status,
        providerEnvelopeId: envelope.providerEnvelopeId,
      });
      return { id, status: envelope.status };
    } catch (err) {
      await this.deps.requests.updateStatus(ctx, id, { status: 'EXPIRED' });
      throw err;
    }
  }

  async refreshStatus(ctx: TenantContext, id: string): Promise<SignatureRequestRecord | null> {
    const record = await this.deps.requests.findById(ctx, id);
    if (!record || !record.providerEnvelopeId) return record;
    const envelope = await this.deps.signature.getEnvelope(record.providerEnvelopeId);
    if (envelope.status !== record.status) {
      await this.deps.requests.updateStatus(ctx, id, { status: envelope.status });
    }
    return this.deps.requests.findById(ctx, id);
  }

  async list(ctx: TenantContext, limit?: number): Promise<SignatureRequestRecord[]> {
    return this.deps.requests.listRecent(ctx, limit);
  }
}
