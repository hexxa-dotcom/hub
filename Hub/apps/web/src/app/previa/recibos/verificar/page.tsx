import {notFound} from 'next/navigation';
import ConsultaRecibo from '@/components/recibo/ConsultaRecibo';
export const metadata={robots:{index:false,follow:false}};
export default async function Preview({searchParams}:{searchParams:Promise<Record<string,string>>}) {
 if(process.env.NODE_ENV==='production')notFound();
 const p=await searchParams;
 return <ConsultaRecibo demo receipt={{number:p.numero || 'REC-202609-H7B49F',issuer:p.emissor || 'Aurora Participações Ltda.',reference:p.mes || '09/2026',amount:Number(p.valor || 16470),paid:p.pagamento || '08/09/2026',canceled:p.cancelado==='true',signature:p.assinante ? {name:p.assinante,date:p.assinaturaEm || ''} : null}}/>;
}
