import {NextResponse} from 'next/server';
import {cookies} from 'next/headers';
import {withTenant,sql,registrarEventoDaEntrega} from '@hexxa/db';
import {getTenantContext,CONTADOR_NA_AREA_COOKIE} from '@/lib/server/tenant';
import {requireAdminApi} from '@/lib/server/admin-guard';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}) {
 const {id}=await params;if(!/^[a-f0-9-]{36}$/i.test(id))return NextResponse.json({error:'Documento inválido.'},{status:400});
 const url=new URL(req.url);const admin=url.searchParams.get('area')==='contador';
 let companyId:string;
 if(admin){const denied=await requireAdminApi();if(denied)return denied;companyId=url.searchParams.get('companyId') || '';if(!/^[a-f0-9-]{36}$/i.test(companyId))return NextResponse.json({error:'Empresa inválida.'},{status:400});}
 else companyId=(await getTenantContext()).companyId;
 const contador=admin || (await cookies()).get(CONTADOR_NA_AREA_COOKIE)?.value===companyId;
 const original=url.searchParams.get('origem')==='termo';
 const r=await withTenant(companyId,async tx=>{
  if(original){const [p]=await tx.execute(sql`SELECT source_pdf AS file,source_name AS name FROM tax_installment_plan WHERE company_id=${companyId} AND id=${id}::uuid`);return p;}
  const [g]=await tx.execute(sql`SELECT g.file_url AS file,g.tax_name AS name,d.id AS delivery FROM tax_guide g LEFT JOIN document_delivery d ON d.tax_guide_id=g.id AND d.company_id=g.company_id WHERE g.company_id=${companyId} AND g.id=${id}::uuid AND g.installment_group_id IS NOT NULL`);
  if(g?.file && g.delivery)await registrarEventoDaEntrega(tx,String(g.delivery),companyId,contador?'ABERTO_PELO_CONTADOR':url.searchParams.get('modo')==='baixar'?'BAIXADO':'VISUALIZADO');
  return g;
 });
 if(r?.file && /^https:\/\//i.test(String(r.file)))return NextResponse.redirect(String(r.file),{headers:{'Cache-Control':'private, no-store'}});
 if(!r?.file || !String(r.file).startsWith('data:application/pdf;base64,'))return NextResponse.json({error:'PDF indisponível.'},{status:404});
 const name=String(r.name || 'Parcelamento').replace(/[^\w.\- ]/g,'_').slice(0,160);
 return new NextResponse(Buffer.from(String(r.file).split(',')[1] || '','base64'),{headers:{'Content-Type':'application/pdf','Content-Disposition':`${url.searchParams.get('modo')==='baixar'?'attachment':'inline'}; filename="${name.endsWith('.pdf')?name:name+'.pdf'}"`,'Cache-Control':'private, no-store'}});
}
