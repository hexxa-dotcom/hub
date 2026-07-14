import { NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { getDb } from '@hexxa/db/client';
import { appUser, company } from '@hexxa/db/schema/tenancy';
import { eq } from 'drizzle-orm';

// Este é o endpoint que o Asaas vai chamar
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Eventos de confirmação de pagamento do Asaas
    if (body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED') {
      const payment = body.payment;
      
      // NOTA: Em produção, quando você gerar a cobrança no Asaas, você deve enviar 
      // o `userId` ou `email` do usuário no campo `externalReference` do Asaas.
      // Aqui vamos simular que recebemos o email ou authUid no externalReference.
      const userAuthUid = payment.externalReference;

      if (!userAuthUid) {
        return NextResponse.json({ error: 'Missing externalReference (authUid)' }, { status: 400 });
      }

      // 1. Atualizar o metadata do Clerk para liberar o acesso (Middleware)
      const client = await clerkClient();
      await client.users.updateUserMetadata(userAuthUid, {
        publicMetadata: {
          authorized: true,
        }
      });

      // 2. Opcional: Atualizar a tabela de assinatura no nosso Banco de Dados
      // const db = getDb();
      // ... update subscription table to ACTIVE ...

      return NextResponse.json({ success: true, message: 'Usuário autorizado com sucesso!' });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Erro no Webhook do Asaas:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
