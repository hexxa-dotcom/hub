import {notFound} from 'next/navigation';
import ParcelamentosHub from '@/components/parcelamentos/ParcelamentosHub';
import {exemploPlano,montarParcelas,type Parcela} from '@/lib/parcelamentos';
export default async function Page({searchParams}:{searchParams:Promise<{area?:string}>}) {
 if(process.env.NODE_ENV==='production')notFound();
 const area=(await searchParams).area==='contador'?'contador':'cliente';
 const id='11111111-1111-4111-8111-111111111111';
 const demoPlan={...exemploPlano,installmentCount:60,totalAmount:60000};
 const guides:Parcela[]=montarParcelas(demoPlan,'2026-09-30').map(r=>({id:`demo-${r.number}`,taxName:`Parcelamento — Simples Nacional (${r.number}/60)`,referenceMonth:r.referenceMonth,amount:r.amount,dueDate:r.dueDate,status:r.status,fileUrl:null,pixCode:null,installmentGroupId:id,installmentNumber:r.number,installmentCount:60,installmentEstimated:true,requestedAt:r.number===3?'2026-09-29':null}));
 return <main className="min-h-screen bg-[#F3F2EE] px-5 py-8 text-[#0E0E10]"><div className="mx-auto max-w-5xl"><img src="/brand/hexx-horizontal-preto.svg" alt="Hexx" className="mb-8 h-8"/><p className="mb-2 text-xs uppercase tracking-widest text-[#8A8A86]">{area==='contador'?'Área do contador':'Minha contabilidade'} / Guias</p><ParcelamentosHub key={area} demo area={area} initialGuides={guides} initialPlans={[{id,description:exemploPlano.description,tax:exemploPlano.tax,authority:exemploPlano.authority,agreement:exemploPlano.agreement,totalAmount:60000,sourceName:'Recibo de adesão — exemplo.pdf'}]}/></div></main>;
}
