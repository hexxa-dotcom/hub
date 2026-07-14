'use server';

import { revalidatePath } from 'next/cache';
import postgres from 'postgres';

export async function updateCompanyAction(companyId: string, formData: FormData) {
  const sql = postgres(process.env.DATABASE_URL!);
  
  try {
    await sql`
      UPDATE company SET
        legal_name = ${formData.get('legalName') as string},
        trade_name = ${formData.get('tradeName') as string},
        use_trade_name = ${formData.get('useTradeName') === 'on'},
        cnpj = ${formData.get('cnpj') as string},
        municipal_registration = ${formData.get('municipalRegistration') as string},
        address_line1 = ${formData.get('addressLine1') as string},
        address_number = ${formData.get('addressNumber') as string},
        neighborhood = ${formData.get('neighborhood') as string},
        city = ${formData.get('city') as string},
        state = ${formData.get('state') as string},
        zipcode = ${formData.get('zipcode') as string}
      WHERE id = ${companyId}
    `;
  } catch (error: any) {
    console.error('Update company error:', error);
    throw new Error(error.message || 'Falha ao atualizar dados da empresa.');
  } finally {
    await sql.end();
  }

  revalidatePath('/configuracoes');
}
