'use server';

import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

interface PixChargeData {
  customerName: string;
  customerCpfCnpj: string;
  value: number;
  dueDate: string;
  description: string;
}

export async function generatePixCharge(data: PixChargeData) {
  const ctx = await getTenantContext();
  const supabase = await createRawClient();

  // 1. Obter a chave da integração
  const { data: cred } = await supabase
    .from('integration_credential')
    .select('secret_ref, active')
    .eq('company_id', ctx.companyId)
    .eq('provider', 'asaas')
    .single();

  if (!cred?.active || !cred?.secret_ref?.access_token) {
    throw new Error('Integração com Asaas não configurada ou inativa.');
  }

  const apiKey = cred.secret_ref.access_token;
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
    }),
  });

  // 4. Obter o QR Code do PIX gerado
  const qrCodeRes = await asaasFetch(`/payments/${chargeRes.id}/pixQrCode`, { method: 'GET' });

  return {
    paymentId: chargeRes.id,
    invoiceUrl: chargeRes.invoiceUrl,
    pixCopyPaste: qrCodeRes.payload,
    encodedImage: qrCodeRes.encodedImage, // base64 do QRCode
  };
}
