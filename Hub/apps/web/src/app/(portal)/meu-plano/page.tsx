import { MeuPlanoClient } from './MeuPlanoClient';

export const metadata = {
  title: 'Meu Plano & Pagamentos | Hexx',
};

export default function Page() {
  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Meu Plano & Pagamentos</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Gerencie seu contrato contábil, mensalidades, formas de pagamento e emissão de recibos.
        </p>
      </header>

      <MeuPlanoClient />
    </div>
  );
}
