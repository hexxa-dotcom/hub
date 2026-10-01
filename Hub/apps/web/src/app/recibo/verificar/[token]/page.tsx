import {notFound} from 'next/navigation';
import {consultarReciboPublico} from '@/lib/server/recibos';
import ConsultaRecibo from '@/components/recibo/ConsultaRecibo';
export const dynamic='force-dynamic';
export const metadata={title:'Conferir recibo | Hexx',robots:{index:false,follow:false}};
export default async function Verificar({params}:{params:Promise<{token:string}>}) {
 const r=await consultarReciboPublico((await params).token);
 if(!r)notFound();
 return <ConsultaRecibo receipt={r}/>;
}
