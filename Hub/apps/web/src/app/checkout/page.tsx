'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { CreditCard, Loader2 } from 'lucide-react';

export default function CheckoutPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 text-zinc-500 animate-spin" />
      </div>
    );
  }

  // If already authorized, send back to feed
  if ((user?.publicMetadata as any)?.authorized) {
    router.push('/feed' as any);
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-4 text-center">
      <div className="w-16 h-16 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl">
        <CreditCard className="w-8 h-8 text-emerald-500" />
      </div>
      
      <h1 className="text-2xl font-semibold text-white tracking-tight mb-2">
        Finalize sua Assinatura
      </h1>
      
      <p className="text-zinc-400 text-sm max-w-sm mb-8 mx-auto">
        Integração com o Asaas em andamento. Após a confirmação do seu pagamento, seu acesso será liberado automaticamente.
      </p>

      {/* Simulated Asaas Checkout Button - In production this will be the actual Asaas iframe/link */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-auto backdrop-blur-xl">
        <p className="text-zinc-300 text-sm mb-4">
          Valor do Plano: <span className="text-emerald-400 font-medium">R$ 97,00/mês</span>
        </p>
        <button 
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-xl px-4 py-3 transition-colors"
          onClick={() => alert("Em produção, isso abrirá o Checkout do Asaas!")}
        >
          Pagar com Asaas
        </button>
      </div>
    </div>
  );
}
