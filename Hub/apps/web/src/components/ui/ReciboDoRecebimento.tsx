 'use client';
import { useState, useTransition } from 'react';
import { FileText } from 'lucide-react';
import { executarReciboAction,obterOpcoesReciboAction } from '@/app/(portal)/meu-negocio/recibos/actions';

export function ReciboDoRecebimento({ entryId }: { entryId: string }) {
 const [busy,start]=useTransition();
 const [message,setMessage]=useState('');
 const [path,setPath]=useState<string|null>(null);
 const [options,setOptions]=useState<{canSign:boolean;signerName:string|null}|null>(null);
 const [sign,setSign]=useState(false);
 return <span className="inline-flex flex-wrap items-center gap-2">
  <button disabled={busy} onClick={()=>start(async()=>{
   const r=await obterOpcoesReciboAction(entryId);
   if(r.ok && 'canSign' in r){setOptions({canSign:r.canSign,signerName:r.signerName});setSign(r.canSign);setMessage('');}
   else setMessage('message' in r ? r.message || '' : 'Não foi possível carregar.');
  })} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1 text-[11px] font-semibold text-ink disabled:opacity-50 dark:border-white/10"><FileText size={12}/>{busy ? 'Processando…':'Emitir recibo'}</button>
  {options && <span role="dialog" aria-label="Opções de emissão do recibo" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><span className="block w-full max-w-md space-y-5 rounded-3xl bg-[#F5F6F4] p-7 text-[#141615]"><span className="block font-serif text-2xl">Emitir recibo</span><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sign} disabled={!options.canSign} onChange={e=>setSign(e.target.checked)}/>Assinar eletronicamente este recibo</label><span className="block text-xs text-[#6E6A61]">{options.canSign ? `Autorizado por ${options.signerName}. Desmarque para emitir sem assinatura.`:'Sem autorização de assinatura para este recebedor. Você pode emitir sem assinar ou configurar a assinatura na central de recibos.'}</span><span className="flex gap-3"><button disabled={busy} onClick={()=>setOptions(null)} className="rounded-full border px-4 py-2 text-xs">Voltar</button><button disabled={busy} onClick={()=>start(async()=>{
   const r=await executarReciboAction({action:'emitir',id:entryId,sign});setMessage(r.message);
   if(r.ok){setOptions(null);if('path' in r && r.path)setPath(r.path);}
  })} className="rounded-full bg-[#2F4A3C] px-4 py-2 text-xs font-semibold text-[#DFFFAE]">{busy ? 'Emitindo…':'Emitir recibo'}</button></span></span></span>}
  {path && <a className="text-xs font-semibold underline" href={path} target="_blank" rel="noopener noreferrer">Abrir PDF</a>}
  {path && <a className="text-xs font-semibold underline" href="/meu-negocio/recibos">Enviar ou baixar</a>}
  {message && <span role="status" className="max-w-sm text-[11px] text-ink-soft">{message}</span>}
 </span>;
}
