import { MeuPlanoClient } from './MeuPlanoClient';
import { getPlanoAtualAction, listarFaturasAction, prepararCheckoutAction } from './actions';
import { SectionHero } from '@/components/ui/SectionHero';
import { dadosDoEscritorio, linkDoWhatsapp } from '@/lib/server/escritorio';
import { getDb, sql } from '@hexxa/db';
import { getTenantContext } from '@/lib/server/tenant';
import { acessoDoPlano } from '@/lib/server/plano';
import { MudarDePlano } from './MudarDePlano';

export const metadata = { title: 'Plano | Hexx Digital' };
export const dynamic = 'force-dynamic';

export default async function Page() {
  await prepararCheckoutAction().catch(() => null);
  const [plano, faturas, escritorio] = await Promise.all([getPlanoAtualAction(), listarFaturasAction(), dadosDoEscritorio()]);
  const ctx = await getTenantContext();
  const acesso = await acessoDoPlano(ctx.companyId);
  // Plano com funções de fora: mostra o completo do Simples ("Com movimento") como próximo passo.
  const [completo] = acesso.bloqueados.length
    ? ((await getDb()
        .execute(sql`SELECT features->>'nomeComercial' AS nome, monthly_value::float AS valor, features->'recursos' AS recursos FROM plan WHERE name = 'Com movimento' LIMIT 1`)
        .catch(() => [])) as unknown as { nome: string; valor: number; recursos: string[] }[])
    : [];

  return (
    <div className="mx-auto w-full space-y-16">
      <SectionHero
        subtitulo="O que você contratou da contabilidade e as faturas de honorários"
        title="Plano"
        infoTitle="Sobre o Plano"
        infoDescription="O plano da sua empresa com a contabilidade, o valor combinado e as faturas mensais de honorários, com os adicionais do mês (colaboradores, sócios extras, admissões)."
      />
      <MeuPlanoClient plano={plano} faturas={faturas} whatsappUrl={linkDoWhatsapp(escritorio.whatsapp, 'Olá! Quero falar sobre a fatura de honorários.')} />
      {completo && (
        <MudarDePlano
          bloqueados={acesso.bloqueados}
          completo={completo}
          whatsappUrl={linkDoWhatsapp(escritorio.whatsapp, `Olá! Quero mudar do plano ${acesso.plano ?? 'atual'} para o ${completo.nome}.`)}
        />
      )}
    </div>
  );
}
