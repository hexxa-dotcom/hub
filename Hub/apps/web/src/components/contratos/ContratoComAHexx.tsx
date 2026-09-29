import { ShieldCheck } from 'lucide-react';
import { DocumentoContratual } from './DocumentoContratual';
import { CONTRATO, TERMOS, VERSAO_CONTRATO, VERSAO_TERMOS } from '@/lib/contratos/textos';
import type { Aceite } from '@/lib/server/contrato-hexx';

/**
 * O contrato de serviços contábeis da empresa com a Hexx, como foi aceito:
 * o Termo de Adesão guardado (texto exato), a prova do aceite e os documentos.
 * Usado na área Contratos do cliente e na ficha do cliente do contador.
 */
export function ContratoComAHexx({ aceites }: { aceites: Aceite[] }) {
  const atual = aceites[0];
  if (!atual) return null;
  const detalhe = 'rounded-2xl border border-black/10 dark:border-white/10';
  const resumo = 'cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#231F20] dark:text-[#F5F6F4]';
  return (
    <section className="rounded-[28px] border border-black/[0.06] bg-white p-6 dark:border-white/[0.08] dark:bg-[#121614]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#231F20] dark:text-[#F5F6F4]">Contrato de serviços contábeis com a Hexx</h2>
          <p className="mt-1 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Aceito em {atual.aceitoEm}
            {atual.aceitoPorNome ? ` por ${atual.aceitoPorNome}` : ''}
            {atual.ip ? ` · IP ${atual.ip}` : ''}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Vigente
        </span>
      </div>
      <div className="mt-4 space-y-2">
        <details className={detalhe}>
          <summary className={resumo}>Termo de Adesão</summary>
          <div className="whitespace-pre-line border-t border-black/10 px-4 py-4 text-sm leading-relaxed text-[#3A3833] dark:border-white/10 dark:text-[#D6D3CC]">
            {atual.textoDaAdesao}
            <p className="mt-3 break-all font-mono text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Código de conferência: {atual.hashDaAdesao}</p>
          </div>
        </details>
        <details className={detalhe}>
          <summary className={resumo}>Contrato de Prestação de Serviços Contábeis · {atual.versaoContrato}</summary>
          <div className="border-t border-black/10 px-4 py-4 dark:border-white/10">
            {atual.versaoContrato === VERSAO_CONTRATO ? <DocumentoContratual secoes={CONTRATO} /> : <p className="text-sm">Versão anterior — peça a cópia ao escritório.</p>}
          </div>
        </details>
        <details className={detalhe}>
          <summary className={resumo}>Termos de Uso e Política de Privacidade · {atual.versaoTermos}</summary>
          <div className="border-t border-black/10 px-4 py-4 dark:border-white/10">
            {atual.versaoTermos === VERSAO_TERMOS ? <DocumentoContratual secoes={TERMOS} /> : <p className="text-sm">Versão anterior — peça a cópia ao escritório.</p>}
          </div>
        </details>
      </div>
      {aceites.length > 1 && (
        <p className="mt-3 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Aceites anteriores: {aceites.slice(1).map((a) => a.aceitoEm).join(' · ')}
        </p>
      )}
    </section>
  );
}
