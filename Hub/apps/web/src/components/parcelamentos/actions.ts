'use server';
import {revalidatePath} from 'next/cache';
import {getTenantContext} from '@/lib/server/tenant';
import {requireAdmin,adminUserId} from '@/lib/server/admin-guard';
import {extrairParcelamento,criarPlanoParcelamento,listarParcelamentos,solicitarGuiaParcela,enviarGuiaParcela,renomearParcelamento} from '@/lib/server/parcelamentos';
import type {PlanoInput} from '@/lib/parcelamentos';
export type ParcelamentoArea='cliente'|'contador';
async function scope(area:ParcelamentoArea,companyId?:string) {
 if(area==='contador'){await requireAdmin();if(!companyId || !/^[a-f0-9-]{36}$/i.test(companyId))throw new Error('Empresa inválida.');return companyId;}
 return (await getTenantContext()).companyId;
}
const message=(e:unknown)=>{
 let cause:unknown=e;
 for(let i=0;i<5 && cause && typeof cause==='object';i++){
  const error=cause as {code?:string;cause?:unknown};
  if(error.code==='42P01' || error.code==='42703')return 'O cadastro de parcelamentos ainda precisa da atualização do banco de dados. O documento não foi cadastrado. Avise a administração do Hub.';
  cause=error.cause;
 }
 if(!(e instanceof Error))return 'Não foi possível concluir. Tente novamente.';
 if(/Failed query:|params:|data:application|base64|api.key|https?:\/\//i.test(e.message))return 'Não foi possível processar o documento. Verifique a configuração do serviço e tente novamente.';
 return e.message.slice(0,500);
};
function refresh(id:string){revalidatePath('/minha-contabilidade/guias');revalidatePath('/cliente');revalidatePath(`/contador/clientes/${id}/guias`);}
export async function lerParcelamentoAction(area:ParcelamentoArea,companyId:string|undefined,fd:FormData) {
 try {const id=await scope(area,companyId);return {ok:true as const,...await extrairParcelamento(id,fd.get('file') as File)};}catch(e){return {ok:false as const,message:message(e)};}
}
export async function criarPlanoAction(area:ParcelamentoArea,companyId:string|undefined,input:PlanoInput,importId?:string,confirmHistory=false) {
 try {const id=await scope(area,companyId);const r=await criarPlanoParcelamento(id,input,importId,confirmHistory);refresh(id);return {ok:true as const,...r,...await listarParcelamentos(id)};}catch(e){return {ok:false as const,message:message(e)};}
}
export async function listarPlanosAction(area:ParcelamentoArea,companyId?:string) {
 try{return {ok:true as const,...await listarParcelamentos(await scope(area,companyId))};}catch(e){return {ok:false as const,message:message(e)};}
}
export async function pedirGuiaAction(id:string) {
 try {const ctx=await getTenantContext();const r=await solicitarGuiaParcela(ctx.companyId,id);refresh(ctx.companyId);return {ok:true as const,message:r.requested?'Solicitação registrada para a contabilidade.':'Solicitação já registrada ou guia disponível.',...await listarParcelamentos(ctx.companyId)};}catch(e){return {ok:false as const,message:message(e)};}
}
export async function publicarGuiaParcelaAction(companyId:string,id:string,fd:FormData) {
 await requireAdmin();
 try {const cid=await scope('contador',companyId);const r=await enviarGuiaParcela(cid,id,fd.get('file') as File,Number(fd.get('amount')),String(fd.get('due') || ''),String(fd.get('pix') || ''),await adminUserId());refresh(cid);return {ok:true as const,message:`Guia enviada ao cliente · protocolo ${r.protocolo}`,...await listarParcelamentos(cid)};}catch(e){return {ok:false as const,message:message(e)};}
}

export async function renomearPlanoAction(area:ParcelamentoArea,companyId:string|undefined,id:string,name:string) {
 try{const cid=await scope(area,companyId);const plan=await renomearParcelamento(cid,id,name);refresh(cid);return {ok:true as const,plan};}catch(e){return {ok:false as const,message:message(e)};}
}
