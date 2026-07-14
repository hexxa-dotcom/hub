import { and, eq } from 'drizzle-orm';
import type { TenantContext } from '@hexxa/core';
import type { CustomerRepository, EnsureCustomerInput } from '@hexxa/core/ports';
import { withTenant } from '../client';
import { customer } from '../schema/service-ops';

export class DrizzleCustomerRepository implements CustomerRepository {
  async ensure(ctx: TenantContext, input: EnsureCustomerInput): Promise<{ id: string }> {
    return withTenant(ctx.companyId, async (tx) => {
      if (input.document) {
        const found = await tx
          .select({ id: customer.id })
          .from(customer)
          .where(and(eq(customer.companyId, ctx.companyId), eq(customer.document, input.document)))
          .limit(1);
        if (found[0]) return { id: found[0].id };
      }
      const inserted = await tx
        .insert(customer)
        .values({
          companyId: ctx.companyId,
          name: input.name,
          document: input.document,
          email: input.email,
        })
        .returning({ id: customer.id });
      return { id: inserted[0]!.id };
    });
  }
}
