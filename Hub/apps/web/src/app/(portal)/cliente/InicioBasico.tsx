import { getTenantContext } from '@/lib/server/tenant';
import { numerosDoTopo, areasDaEmpresa, type Pendencia } from '@/lib/server/inicio';
import { getAvailableProfitAction } from '@/lib/server/profit-distribution';
import { Cartao } from './Cartao';
import { PendenciasDoDia } from './PendenciasDoDia';

/**
 * INÍCIO NO PERFIL BÁSICO — para quem não quer gráfico.
 *
 * Três perguntas que qualquer empresário faz, em frase e número: quanto
 * entrou, quanto sobrou, quanto é o imposto e quando vence. Embaixo, o que ele
 * precisa fazer hoje. Sem porcentagem, sem mosaico.
 */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/');

export async function InicioBasico({ mes, pendencias }: { mes: string; pendencias: Pendencia[] }) {
  const ctx = await getTenantContext();
  const lucro = await getAvailableProfitAction().catch(() => null);
  const [n, a] = await Promise.all([numerosDoTopo(ctx, mes, lucro?.availableToDistribute ?? 0), areasDaEmpresa(ctx)]);
  const guia = a.impostos.proximaGuia;
  const numero = 'mt-3 text-3xl font-bold tracking-tight tabular-nums sm:text-4xl';
  const frase = 'mt-1 text-sm text-ink-soft';

  return (
    <div className="space-y-10">
      <div className="entrada-grade grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Cartao rotulo="Quanto entrou" href="/meu-negocio/notas" destaque>
          <p className={`${numero} text-[#D4FF00]`}>{BRL.format(n.faturado)}</p>
          <p className="mt-1 text-sm text-white/70">
            {n.notas === 0 ? 'nenhuma nota emitida no mês' : n.notas === 1 ? 'em 1 nota emitida' : `em ${n.notas} notas emitidas`}
          </p>
        </Cartao>
        <Cartao rotulo="Quanto sobrou" href="/meu-negocio/relatorios/balanco">
          <p className={`${numero} ${n.resultado < 0 ? 'text-rose-500' : 'text-ink'}`}>
            {n.resultado < 0 ? '− ' : ''}
            {BRL.format(Math.abs(n.resultado))}
          </p>
          <p className={frase}>{n.resultado < 0 ? 'faltou: as despesas passaram do que entrou' : 'depois das despesas e do imposto'}</p>
        </Cartao>
        <Cartao rotulo="Imposto do mês" href="/minha-contabilidade/guias">
          {guia ? (
            <>
              <p className={`${numero} text-ink`}>{BRL.format(guia.valor)}</p>
              <p className={frase}>vence em {br(guia.vencimento)} · toque para ver a guia</p>
            </>
          ) : (
            <>
              <p className={`${numero} text-ink`}>—</p>
              <p className={frase}>a guia aparece aqui assim que for gerada</p>
            </>
          )}
        </Cartao>
      </div>

      <section id="pede-voce" className="scroll-mt-24 space-y-4">
        <p className="rotulo text-ink-soft">O que pede você</p>
        <PendenciasDoDia itens={pendencias} />
      </section>
    </div>
  );
}
