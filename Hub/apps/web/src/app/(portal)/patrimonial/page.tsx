import { getProperties, listLeasesAction } from './actions';
import { listPartnersAction } from '../minha-contabilidade/socios/actions';
import { PatrimonioApp } from './PatrimonioApp';
import { getTenantContext } from '@/lib/server/tenant';
import { aliquotaDoFaturamento } from '@/lib/server/bussola';
import { SectionHero } from '@/components/ui/SectionHero';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const ctx = await getTenantContext();
  const [properties, partners, leases, taxa] = await Promise.all([
    getProperties(),
    listPartnersAction(),
    listLeasesAction(),
    aliquotaDoFaturamento(ctx).catch(() => ({ aliquota: 0, apurada: false })),
  ]);
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  return (
    <div className="mx-auto w-full space-y-16">
      <SectionHero
        subtitulo="O que a empresa e os sócios têm, quanto vale hoje e o que rende"
        title="Bens"
        infoTitle="Sobre Bens"
        infoDescription="Os bens da empresa (computadores, veículo, móveis, a sala própria) e os bens pessoais dos sócios, com o valor de hoje depois da depreciação. Se a empresa aluga um imóvel, o aluguel entra sozinho no financeiro, com a previsão de imposto pelo regime da empresa."
      />

      <PatrimonioApp
        properties={properties}
        partners={partners.map((p) => ({ id: p.id, nome: p.nome }))}
        leases={leases}
        aliquota={taxa.aliquota}
        hoje={hoje}
      />
    </div>
  );
}
