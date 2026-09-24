import { TrendingUp } from 'lucide-react';
import { sql, withTenant } from '@hexxa/db';
import { calcularAlavancaFatorR } from '@hexxa/core';
import { getTenantContext } from '@/lib/server/tenant';
import { getSimplesInputs, enquadramentoApurado } from '@/lib/server/fiscal';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const PCT = (n: number) => `${n.toFixed(2).replace('.', ',')}%`;

/**
 * "Subindo o pró-labore em R$ X, você economiza R$ Y por mês."
 *
 * O termômetro tributário já mostra o Fator R; isso é diagnóstico. Aqui vira
 * decisão, com o número que o cliente precisa para tomá-la. Ver
 * `calcularAlavancaFatorR` para a conta e para o que fica de fora.
 *
 * ── Quando este card NÃO aparece ───────────────────────────────────────
 *
 * Quando o Fator R não se aplica à atividade. Há empresa no Anexo III por
 * natureza, e para ela subir o pró-labore é mais INSS sem benefício nenhum —
 * conselho errado com cara de cálculo. `enquadramentoApurado` sabe disso pela
 * apuração do contábil, e na dúvida o card se cala.
 */
export async function AlavancaFatorRCard() {
  let dados;
  try {
    const ctx = await getTenantContext();
    const [entradas, apurado] = await Promise.all([
      getSimplesInputs(ctx),
      enquadramentoApurado(ctx),
    ]);

    /**
     * Só quando se SABE que o Fator R decide.
     *
     * `false` = atividade no Anexo III por natureza: subir o pró-labore seria
     * mais INSS sem benefício. `null` = não se sabe ainda, porque o contábil
     * não apurou nenhuma competência. Nos dois casos o card não aparece.
     *
     * Isso torna o card invisível para cliente recém-entrado, e é de
     * propósito: o custo de errar aqui é o cliente pagar INSS a mais por
     * conselho nosso, e o benefício de acertar sobrevive a esperar um mês.
     */
    if (apurado?.fatorRAplica !== true) return null;

    const receitaDoMes = await withTenant(ctx.companyId, async (tx) => {
      const r = (await tx.execute(sql`
        SELECT COALESCE(SUM(amount), 0) AS total
        FROM financial_entry
        WHERE company_id = ${ctx.companyId}
          AND type = 'RECEIVABLE' AND status != 'CANCELED'
          AND source IN ('NFSE', 'DFE_SYNC')
          AND reference_month >= (date_trunc('month', now()) - interval '3 months')::date
          AND reference_month < date_trunc('month', now())::date
      `)) as unknown as { total: string }[];
      // Média dos 3 meses fechados: um mês atípico não deve virar promessa.
      return Number(r[0]?.total ?? 0) / 3;
    });

    dados = calcularAlavancaFatorR({
      rbt12: entradas.rbt12,
      folha12: entradas.folha12,
      folhaEmpregados12: entradas.folhaEmpregados12,
      receitaDoMes,
    });
  } catch (err) {
    console.error('[AlavancaFatorRCard] falhou:', err);
    return null;
  }

  // Sem alavanca, ou já no Anexo III: nada a sugerir. Um card dizendo "está
  // tudo certo" só ocupa espaço na tela.
  if (!dados || dados.jaFavoravel || dados.economiaMensal <= 0) return null;

  return (
    <section data-card="true" className="rounded-3xl border border-black/5 bg-surface-card p-5 dark:border-white/10 sm:p-6 shadow-(--elev-1)">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#1E3328] text-[#DFFFAE]">
          <TrendingUp className="h-3.5 w-3.5" />
        </span>
        <h2 className="rotulo text-[#6E6A61] dark:text-[#A8A49C]">
          Você pode pagar menos imposto
        </h2>
      </div>

      <p className="mt-3 text-sm text-[#231F20] dark:text-[#F5F6F4]">
        Seu pró-labore está em <strong>{PCT(dados.fatorR * 100)}</strong> do faturamento. Subindo
        para 28% — mais <strong>{BRL.format(dados.aumentoMensal)}</strong> por mês — a empresa sai do
        Anexo V para o III.
      </p>

      <div className="mt-4 rounded-2xl bg-[#EFFFD6] px-4 py-3 dark:bg-[#2F4A3C]/30">
        <p className="rotulo text-[#2F4A3C]/80 dark:text-[#DFFFAE]/80">
          Economia no imposto
        </p>
        <p className="font-serif text-2xl font-bold tabular text-[#2F4A3C] dark:text-[#DFFFAE]">
          {BRL.format(dados.economiaMensal)}/mês
        </p>
        <p className="text-xs text-[#2F4A3C]/80 dark:text-[#DFFFAE]/80">
          A alíquota cai de {PCT(dados.aliquotaHoje)} para {PCT(dados.aliquotaNoAnexoIII)}.
        </p>
      </div>

      <p className="mt-3 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
        O aumento custa {BRL.format(dados.inssSobreOAumento)} de INSS por mês — que não é perda, é
        contribuição sua, e volta como aposentadoria. Mesmo assim, sobram{' '}
        <strong className="text-[#231F20] dark:text-[#F5F6F4]">
          {BRL.format(dados.sobraMensal)}
        </strong>{' '}
        por mês. O IRRF sobre o pró-labore adicional não está nesta conta — fale com a contabilidade
        antes de mudar.
      </p>
    </section>
  );
}
