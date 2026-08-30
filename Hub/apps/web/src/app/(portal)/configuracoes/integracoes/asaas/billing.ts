'use server';

import { withTenant, eq, and } from '@hexxa/db';
import { integrationCredential, financialEntry } from '@hexxa/db/schema';
import { getTenantContext } from '@/lib/server/tenant';
import { normalizeDocument } from '@hexxa/core/document-br';

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
    // Nunca simular uma cobrança "paga sozinha" — isso já existiu aqui como
    // fallback pra um gateway mock que confirmava o Pix automaticamente
    // depois de 10s, sem o cliente pagar nada. Perigoso: o contador acharia
    // que recebeu dinheiro real e poderia dar baixa contábil/liberar serviço
    // por engano. Sem Asaas configurado, a cobrança simplesmente não existe.
    throw new Error('Integração com o Asaas não está configurada. Configure em Configurações > Integrações antes de gerar cobranças Pix.');
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
  // normalizeDocument PRESERVA letras — não é a Hexxa quem deve descartar o
  // CNPJ alfanumérico do cliente antes de mandar pro Asaas.
  const cpfCnpj = normalizeDocument(data.customerCpfCnpj);
  const searchRes = await asaasFetch(`/customers?cpfCnpj=${cpfCnpj}`, { method: 'GET' });

  if (searchRes.data && searchRes.data.length > 0) {
    asaasCustomerId = searchRes.data[0].id;
  } else {
    const createCustomerRes = await asaasFetch('/customers', {
      method: 'POST',
      body: JSON.stringify({
        name: data.customerName,
        cpfCnpj,
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

  // 3b. Vincula a cobrança ao lançamento
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
