'use server';

import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential, financialEntry } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';

interface PixChargeData {
  customerName: string;
  customerCpfCnpj: string;
  value: number;
  dueDate: string;
  description: string;
  /**
   * Lançamento (financial_entry) que esta cobrança deve baixar quando paga.
   * Gravamos o id da cobrança do Asaas nesse lançamento na hora da criação —
   * o webhook (/api/webhooks/asaas) usa esse vínculo pra confirmar o
   * recebimento automaticamente, sem depender de externalReference.
   */
  financialEntryId?: string;
}

export async function generatePixCharge(data: PixChargeData) {
  const ctx = await getTenantContext();

  // 1. Obter a chave da integração
  const [cred] = await withTenant(ctx.companyId, async (tx) => {
    return tx
      .select({
        secretRef: integrationCredential.secretRef,
        active: integrationCredential.active,
      })
      .from(integrationCredential)
      .where(
        and(
          eq(integrationCredential.companyId, ctx.companyId),
          eq(integrationCredential.provider, 'asaas')
        )
      );
  });

  const secretData = cred?.secretRef as any;
  if (!cred?.active || !secretData?.access_token) {
    throw new Error('Integração com Asaas não configurada ou inativa.');
  }

  const apiKey = secretData.access_token;
  const asaasBaseUrl = apiKey.includes('sandbox') 
    ? 'https://sandbox.asaas.com/api/v3' 
    : 'https://api.asaas.com/v3';

  // Helper para requisições
  const asaasFetch = async (path: string, options: RequestInit) => {
    const res = await fetch(`${asaasBaseUrl}${path}`, {
      ...options,
      headers: {
        'access_token': apiKey,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.errors?.[0]?.description || 'Erro na API Asaas');
    return json;
  };

  // 2. Buscar ou Criar o Cliente no Asaas
  let asaasCustomerId: string;
  const searchRes = await asaasFetch(`/customers?cpfCnpj=${data.customerCpfCnpj.replace(/\D/g, '')}`, { method: 'GET' });
  
  if (searchRes.data && searchRes.data.length > 0) {
    asaasCustomerId = searchRes.data[0].id;
  } else {
    const createCustomerRes = await asaasFetch('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: data.customerName,
        cpfCnpj: data.customerCpfCnpj.replace(/\D/g, ''),
      }),
    });
    asaasCustomerId = createCustomerRes.id;
  }

  // 3. Criar a Cobrança PIX
  const chargeRes = await asaasFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: asaasCustomerId,
      billingType: 'PIX',
      value: data.value,
      dueDate: data.dueDate,
      description: data.description,
      ...(data.financialEntryId ? { externalReference: data.financialEntryId } : {}),
    }),
  });

  // 3b. Vincula a cobrança ao lançamento — o webhook confirma o recebimento
  // automaticamente por esse id quando o Pix cair.
  if (data.financialEntryId) {
    await withTenant(ctx.companyId, async (tx) => {
      await tx
        .update(financialEntry)
        .set({ externalId: String(chargeRes.id) })
        .where(and(eq(financialEntry.id, data.financialEntryId!), eq(financialEntry.companyId, ctx.companyId)));
    });
  }

  // 4. Obter o QR Code do PIX gerado
  const qrCodeRes = await asaasFetch(`/payments/${chargeRes.id}/pixQrCode`, { method: 'GET' });

  return {
    paymentId: chargeRes.id,
    invoiceUrl: chargeRes.invoiceUrl,
    pixCopyPaste: qrCodeRes.payload,
    encodedImage: qrCodeRes.encodedImage, // base64 do QRCode
  };
}
