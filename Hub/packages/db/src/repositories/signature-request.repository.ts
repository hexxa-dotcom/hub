import { desc, eq } from 'drizzle-orm';
import type { TenantContext } from '@hexxa/core';
import type {
  SignatureRequestRepository,
  NewSignatureRequest,
  SignatureRequestPatch,
  SignatureRequestRecord,
} from '@hexxa/core/ports';
import { withTenant } from '../client';
import { signatureRequest } from '../schema/service-ops';

export class DrizzleSignatureRequestRepository implements SignatureRequestRepository {
  async create(ctx: TenantContext, data: NewSignatureRequest): Promise<{ id: string }> {
    return withTenant(ctx.companyId, async (tx) => {
      const inserted = await tx
        .insert(signatureRequest)
        .values({
          companyId: ctx.companyId,
          subjectType: data.subjectType,
          subjectId: data.subjectId,
          title: data.title,
          signerName: data.signerName,
          signerEmail: data.signerEmail,
          status: 'PENDING',
        })
        .returning({ id: signatureRequest.id });
      return { id: inserted[0]!.id };
    });
  }

  async updateStatus(ctx: TenantContext, id: string, patch: SignatureRequestPatch): Promise<void> {
    const set: Partial<typeof signatureRequest.$inferInsert> = { updatedAt: new Date() };
    if (patch.status) set.status = patch.status;
    if (patch.providerEnvelopeId !== undefined) set.providerEnvelopeId = patch.providerEnvelopeId;

    await withTenant(ctx.companyId, async (tx) => {
      await tx.update(signatureRequest).set(set).where(eq(signatureRequest.id, id));
    });
  }

  async listRecent(ctx: TenantContext, limit = 20): Promise<SignatureRequestRecord[]> {
    return withTenant(ctx.companyId, async (tx) => {
      const rows = await tx
        .select()
        .from(signatureRequest)
        .where(eq(signatureRequest.companyId, ctx.companyId))
        .orderBy(desc(signatureRequest.createdAt))
        .limit(limit);
      return rows.map((r) => ({
        id: r.id,
        title: r.title,
        signerName: r.signerName,
        signerEmail: r.signerEmail,
        status: r.status,
        providerEnvelopeId: r.providerEnvelopeId,
        createdAt: r.createdAt.toISOString(),
      }));
    });
  }

  async findById(ctx: TenantContext, id: string): Promise<SignatureRequestRecord | null> {
    return withTenant(ctx.companyId, async (tx) => {
      const rows = await tx.select().from(signatureRequest).where(eq(signatureRequest.id, id)).limit(1);
      const r = rows[0];
      if (!r) return null;
      return {
        id: r.id,
        title: r.title,
        signerName: r.signerName,
        signerEmail: r.signerEmail,
        status: r.status,
        providerEnvelopeId: r.providerEnvelopeId,
        createdAt: r.createdAt.toISOString(),
      };
    });
  }
}
