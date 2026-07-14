import { NextRequest, NextResponse } from 'next/server';
import {
  createCustomer,
  findCustomerByCpfCnpj,
  AsaasError,
} from '@/lib/asaas';

/** POST /api/asaas/customers
 *  Body: { name, cpfCnpj, email, phone?, externalReference? }
 *  Retorna o customer existente se já cadastrado, ou cria um novo.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, cpfCnpj, email, phone, externalReference } = body;

    if (!name || !cpfCnpj || !email) {
      return NextResponse.json({ error: 'name, cpfCnpj e email são obrigatórios' }, { status: 400 });
    }

    // Evita duplicata: verifica se já existe pelo CPF/CNPJ
    const existing = await findCustomerByCpfCnpj(cpfCnpj);
    if (existing) {
      return NextResponse.json({ customer: existing, created: false });
    }

    const customer = await createCustomer({ name, cpfCnpj, email, phone, externalReference });
    return NextResponse.json({ customer, created: true });
  } catch (err) {
    if (err instanceof AsaasError) {
      return NextResponse.json({ error: 'Erro Asaas', detail: err.body }, { status: err.status });
    }
    const msg = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
