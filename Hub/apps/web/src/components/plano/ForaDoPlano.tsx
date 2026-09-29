import Link from 'next/link';
import { Lock, ArrowRight } from 'lucide-react';
import { getTenantContext } from '@/lib/server/tenant';
import { acessoDoPlano } from '@/lib/server/plano';
import { MODULOS, type ModuloDoPlano } from '@/lib/plano-acesso';

/**
 * Trava de módulo por plano. Fora do plano, a tela mostra o que a função faz
 * e o convite para mudar — a função não some do menu, vende o upgrade.
 * Usado no layout de cada módulo que um plano pode deixar de fora.
 */
export async function ForaDoPlano({ modulo, children }: { modulo: ModuloDoPlano; children: React.ReactNode }) {
  const ctx = await getTenantContext();
  const acesso = await acessoDoPlano(ctx.companyId);
  if (!acesso.bloqueados.includes(modulo)) return <>{children}</>;

  const m = MODULOS[modulo];
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg items-center justify-center px-4">
      <div className="w-full rounded-[28px] border border-black/[0.06] bg-white p-8 text-center shadow-sm dark:border-white/[0.08] dark:bg-[#121614]">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-black/[0.05] dark:bg-white/[0.08]">
          <Lock className="h-5 w-5 text-ink" />
        </div>
        <h1 className="text-lg font-light uppercase tracking-[0.05em] text-ink">{m.nome}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{m.oQueFaz}</p>
        <p className="mt-3 text-sm text-ink-soft">
          Não faz parte do plano <strong className="text-ink">{acesso.plano ?? 'atual'}</strong>. Está no plano Simples Completo, junto com notas sem limite.
        </p>
        <Link
          href={'/meu-plano' as never}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#1E3328] px-6 py-3 text-sm font-semibold text-[#DFFFAE] transition-colors hover:bg-[#2F4A3C]"
        >
          Conhecer o plano Simples Completo <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
