import { z } from 'zod';
const iso=z.string().refine(s=>/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00Z`).valueOf()) && new Date(`${s}T12:00:00Z`).toISOString().slice(0,10)===s,'Informe uma data válida.');
const money=z.number().positive().max(1e11).refine(n=>Math.abs(n*100-Math.round(n*100))<0.0001,'Use até dois decimais.');
export const planoSchema=z.object({
 description:z.string().trim().min(3).max(180),tax:z.string().trim().min(2).max(80),authority:z.string().trim().min(2).max(80),
 agreement:z.string().trim().max(100),cnpj:z.string().transform(s=>s.replace(/\D/g,'')).refine(s=>s.length===14,'Informe o CNPJ do documento.'),
 totalAmount:money,installmentCount:z.number().int().min(2).max(240),installmentAmount:money,firstAmount:money,
 firstDueDate:iso,paidCount:z.number().int().min(0).max(240),
}).refine(p=>p.paidCount<=p.installmentCount,'O número de parcelas pagas supera o total.');
export type PlanoInput=z.infer<typeof planoSchema>;
export interface PlanoMeta {id:string;description:string;tax:string;authority:string;agreement:string;totalAmount:number;sourceName:string|null}
export interface Parcela {id:string;taxName:string;referenceMonth:string;amount:number;dueDate:string;status:'OPEN'|'OVERDUE'|'PAID';fileUrl:string|null;pixCode:string|null;installmentGroupId:string|null;installmentNumber:number|null;installmentCount:number|null;installmentEstimated?:boolean;requestedAt?:string|null}
export function vencimentoParcela(first:string,index:number):string {
 const [y,m,d]=first.split('-').map(Number);
 const month=new Date(Date.UTC(y!,m!-1+index,1,12));
 const last=new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth()+1,0)).getUTCDate();
 return new Date(Date.UTC(month.getUTCFullYear(),month.getUTCMonth(),Math.min(d!,last),12)).toISOString().slice(0,10);
}
export function montarParcelas(input:PlanoInput,today:string) {
 const p=planoSchema.parse(input);
 return Array.from({length:p.installmentCount},(_,i)=>{
  const monthDate=vencimentoParcela(p.firstDueDate,i);
  const dueDate=i>0 && i>=p.paidCount && parcelamentoFederal(p)?ultimoDiaUtilFederal(monthDate.slice(0,7)):monthDate;
  return {number:i+1,dueDate,referenceMonth:dueDate.slice(0,7)+'-01',amount:i===0?p.firstAmount:p.installmentAmount,
   status:i<p.paidCount ? 'PAID' as const:dueDate<today ? 'OVERDUE' as const:'OPEN' as const};
 });
}
export function resumoParcelamento(rows:Parcela[],today:string) {
 const sorted=[...rows].sort((a,b)=>(a.installmentNumber || 0)-(b.installmentNumber || 0));
 const unpaid=sorted.filter(p=>p.status!=='PAID');
 return {sorted,paid:sorted.length-unpaid.length,remaining:unpaid.length,total:sorted.reduce((s,p)=>s+Math.round(p.amount*100),0)/100,
  balance:unpaid.reduce((s,p)=>s+Math.round(p.amount*100),0)/100,
  current:unpaid.find(p=>p.dueDate.slice(0,7)===today.slice(0,7)) || unpaid[0] || null};
}
export const exemploPlano:PlanoInput={description:'Simples Nacional — débitos de 2025',tax:'Simples Nacional',authority:'Receita Federal',agreement:'2026.001234',cnpj:'12345678000195',totalAmount:24000,installmentCount:24,installmentAmount:1000,firstAmount:1000,firstDueDate:'2026-07-31',paidCount:2};

export type FiltroParcelas='primeiras12'|'ano'|'todas';
export function filtrarParcelas(rows:Parcela[],filter:FiltroParcelas,today:string) {
 const sorted=[...rows].sort((a,b)=>(a.installmentNumber || 0)-(b.installmentNumber || 0));
 return filter==='ano'?sorted.filter(p=>p.dueDate.slice(0,4)===today.slice(0,4)):filter==='primeiras12'?sorted.slice(0,12):sorted;
}
export function dataLiberacaoParcela(p:Pick<Parcela,'dueDate'|'installmentNumber'>) {
 return p.installmentNumber===1?null:p.dueDate.slice(0,7)+'-10';
}
export function guiaLiberada(p:Pick<Parcela,'dueDate'|'installmentNumber'>,today:string) {
 const release=dataLiberacaoParcela(p);return !release || today>=release;
}
export function parcelamentoFederal(p:Pick<PlanoMeta,'authority'|'tax'>) {
 return /federal|\brfb\b|\bpgfn\b|simples nacional/i.test(p.authority+' '+p.tax);
}
// Previsão pelo calendário nacional bancário (inclui Carnaval e fechamento de 31/12); o vencimento da guia oficial sempre prevalece.
export function ultimoDiaUtilFederal(yearMonth:string) {
 const [y,m]=yearMonth.split('-').map(Number);const year=y!;
 const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,n=Math.floor((a+11*h+22*l)/451);
 const easterMonth=Math.floor((h+l-7*n+114)/31),easterDay=(h+l-7*n+114)%31+1;
 const friday=new Date(Date.UTC(year,easterMonth-1,easterDay-2,12)).toISOString().slice(0,10);
 const carnival=[48,47].map(offset=>new Date(Date.UTC(year,easterMonth-1,easterDay-offset,12)).toISOString().slice(0,10));
 const fixed=['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-25','12-31'];
 const cursor=new Date(Date.UTC(year,m!,0,12));
 while(cursor.getUTCDay()===0 || cursor.getUTCDay()===6 || fixed.includes(cursor.toISOString().slice(5,10)) || cursor.toISOString().slice(0,10)===friday || carnival.includes(cursor.toISOString().slice(0,10)))cursor.setUTCDate(cursor.getUTCDate()-1);
 return cursor.toISOString().slice(0,10);
}
export function ajustarVencimentosPrevistos(rows:Parcela[],plans:PlanoMeta[],today:string) {
 return rows.map(p=>{
  const meta=plans.find(plan=>plan.id===p.installmentGroupId);
  if(!meta || !parcelamentoFederal(meta) || !p.installmentEstimated || p.status==='PAID' || p.fileUrl || (p.installmentNumber || 0)<=1)return p;
  const dueDate=ultimoDiaUtilFederal(p.dueDate.slice(0,7));
  return {...p,dueDate,status:dueDate<today?'OVERDUE' as const:'OPEN' as const};
 });
}
