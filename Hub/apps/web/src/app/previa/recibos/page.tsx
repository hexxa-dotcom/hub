import { notFound } from 'next/navigation';
import RecibosClient from '@/app/(portal)/meu-negocio/recibos/RecibosClient';

export default async function PreviaRecibos({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const holding = (await searchParams).tipo !== 'servicos';
  return <main className="min-h-screen bg-[#F5F6F4] dark:bg-[#141615]">
    <div className="mx-auto max-w-6xl px-8 pt-7"><img src="/brand/hexx-horizontal-preto.svg" alt="Hexx" className="h-8 w-auto dark:invert"/></div>
    <RecibosClient key={holding ? 'holding' : 'servicos'} demo holding={holding}
      expenses={[{id:"e91d2004-df28-4776-9019-aa09e23dd358",description:"Condomínio — Apartamento 802",amount:450},{id:"e91d2004-df28-4776-9019-aa09e23dd359",description:"IPTU — Apartamento 802",amount:150}]}
      receipts={[
        { id: 'demo1', entryId: 'p1', number: 'REC-202609-7B49F3', amount: 14500, description: holding ? 'Aluguel — Conjunto comercial 1402' : 'Assessoria — Setembro', payer: 'Studio Lumina Ltda.', referenceMonth: '09/2026', paidAt: '08/09/2026', issuedAt: '08/09/2026', fiscalEligible: holding, oneflowStatus: holding ? 'AGUARDANDO_CONFIGURACAO' : 'NAO_APLICAVEL', canceled: false, invoiceNumber: holding ? null : '124' },
        { id: 'demo2', entryId: 'p2', number: 'REC-202609-A892C1', amount: 4200, description: holding ? 'Aluguel — Sala comercial 305' : 'Consultoria — Projeto de expansão', payer: 'Ateliê Forma Ltda.', referenceMonth: '09/2026', paidAt: '12/09/2026', issuedAt: '12/09/2026', fiscalEligible: holding, oneflowStatus: holding ? 'AGUARDANDO_CONFIGURACAO' : 'NAO_APLICAVEL', canceled: false },
      ]}
      candidates={[
        { id: 'parcela03', description: holding ? 'Aluguel — Apartamento 802' : 'Consultoria — Setembro', amount: 3800, payer: 'Marina Oliveira', paidAt: '29/09/2026', status: 'PAID', source: holding ? 'RENT' : 'NFSE', leaseId: holding ? 'aluguel03' : null, referenceMonth: '2026-09', invoiceNumber: holding ? null : '124' },
        { id: 'parcela04', description: holding ? 'Aluguel — Conjunto comercial 1402' : 'Assessoria — Outubro', amount: 14500, payer: 'Studio Lumina Ltda.', paidAt: null, status: 'PENDING', source: holding ? 'RENT' : 'NFSE', leaseId: holding ? 'aluguel04' : null, referenceMonth: '2026-10', invoiceNumber: holding ? null : '125' },
      ]}
      schedules={[
        { id: 'agenda01', description: holding ? 'Aluguel — Casa Jardim Europa' : 'Pagamento — Projeto Horizonte', nextDate: '2026-10-05', recurring: holding, active: true, sendEmail: true, lastError: null },
      ]}
    />
  </main>;
}
