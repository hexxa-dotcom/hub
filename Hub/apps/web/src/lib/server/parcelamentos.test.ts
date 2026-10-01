import {beforeEach,describe,it,expect,vi} from 'vitest';
import {PgDialect} from 'drizzle-orm/pg-core';
const mock=vi.hoisted(()=>({execute:vi.fn(),tenant:vi.fn(),delivery:vi.fn(),llm:vi.fn(),pdf:vi.fn()}));
vi.mock('@hexxa/db',async()=>({sql:(await import('drizzle-orm')).sql,withTenant:mock.tenant,criarEntrega:mock.delivery}));
vi.mock('@hexxa/integrations',()=>({callLlm:mock.llm}));
vi.mock('./llm-config',()=>({credencialDoAmbiente:()=>({provider:'anthropic',apiKey:'test'}),resolverMotor:async()=>({provider:'anthropic',model:'test',apiKey:'test'})}));
vi.mock('pdf-parse',()=>({PDFParse:class {getText(){return mock.pdf();}destroy(){return Promise.resolve();}}}));
import {criarPlanoParcelamento,enviarGuiaParcela,extrairParcelamento,solicitarGuiaParcela,renomearParcelamento} from './parcelamentos';
import {exemploPlano} from '../parcelamentos';
const company='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222';
const dialect=new PgDialect();
const file=()=>new File(['%PDF-documento fictício'],'termo.pdf',{type:'application/pdf'});
beforeEach(()=>{vi.clearAllMocks();mock.tenant.mockImplementation((_id,fn)=>fn({execute:mock.execute}));mock.delivery.mockResolvedValue({id:'delivery',protocolo:'HEXX-1'});});
describe('Importação e guia mensal',()=>{
 it('gera exatamente uma parcela por mês com parâmetros da empresa e sem código Pix copiado',async()=>{
  mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
  const r=await criarPlanoParcelamento(company,exemploPlano,undefined,true);expect(r.existing).toBe(false);
  const q=dialect.sqlToQuery(mock.execute.mock.calls[3]![0]);expect(q.sql).toContain('INSERT INTO tax_guide');expect(q.sql).not.toContain('pix_code');expect(q.params.filter(p=>p===company)).toHaveLength(24);expect(q.params).toContain('2026-09-30');
 });
 it('reimportação retorna o plano existente sem criar novas parcelas',async()=>{
  mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj}]).mockResolvedValueOnce([{id}]);
  expect(await criarPlanoParcelamento(company,exemploPlano,undefined,true)).toEqual({id,existing:true});expect(mock.execute).toHaveBeenCalledTimes(2);
 });
 it('bloqueia CNPJ de outra empresa e histórico de pagamentos sem confirmação',async()=>{
  await expect(criarPlanoParcelamento(company,exemploPlano)).rejects.toThrow('Confirme');
  mock.execute.mockResolvedValueOnce([{cnpj:'98765432000199'}]);await expect(criarPlanoParcelamento(company,exemploPlano,undefined,true)).rejects.toThrow('não corresponde');
 });
 it('explica cadastro encerrado antes de enviar o documento à IA ou gravar parcelas',async()=>{
  mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj,closed_at:new Date()}]);
  await expect(extrairParcelamento(company,file())).rejects.toThrow('cadastro de cliente está encerrado');
  expect(mock.pdf).not.toHaveBeenCalled();expect(mock.llm).not.toHaveBeenCalled();
  mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj,closed_at:new Date()}]);
  await expect(criarPlanoParcelamento(company,exemploPlano,undefined,true)).rejects.toThrow('cadastro de cliente está encerrado');
  expect(mock.execute).toHaveBeenCalledTimes(2);
 });
 it('recusa importação pertencente a outro tenant',async()=>{
  mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj}]).mockResolvedValueOnce([]);
  await expect(criarPlanoParcelamento(company,exemploPlano,id,true)).rejects.toThrow('nesta empresa');
  expect(dialect.sqlToQuery(mock.execute.mock.calls[1]![0]).params).toContain(company);
 });
 it('a IA preenche um rascunho, sem lançar parcelas nem assumir a resposta como comando',async()=>{
  mock.pdf.mockResolvedValue({total:2,text:('TERMO DE PARCELAMENTO. CNPJ do contribuinte: '+exemploPlano.cnpj+'. Documento de adesão da empresa. ').repeat(5)});
  mock.llm.mockResolvedValue({text:JSON.stringify({...exemploPlano,documentKind:'TAX_INSTALLMENT',cnpjEvidence:exemploPlano.cnpj,warnings:['Conferir valor base.'],sql:'DELETE FROM company'})});mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj}]).mockResolvedValueOnce([{id}]);
  const r=await extrairParcelamento(company,file());expect(r.id).toBe(id);expect(r.data).not.toHaveProperty('sql');expect(r.warnings).toEqual(['Conferir valor base.']);expect(r.validatedCnpj).toBe(exemploPlano.cnpj);expect(mock.execute).toHaveBeenCalledTimes(2);expect(dialect.sqlToQuery(mock.execute.mock.calls[1]![0]).sql).not.toContain('tax_guide');
 });

 it('bloqueia recibo de outra empresa durante a leitura, antes de salvar rascunho',async()=>{
  mock.execute.mockResolvedValueOnce([{cnpj:'98765432000199'}]);
  mock.pdf.mockResolvedValue({total:1,text:('TERMO DE PARCELAMENTO. CNPJ '+exemploPlano.cnpj+' ').repeat(8)});
  mock.llm.mockResolvedValue({text:JSON.stringify({...exemploPlano,documentKind:'TAX_INSTALLMENT',cnpjEvidence:exemploPlano.cnpj})});
  await expect(extrairParcelamento(company,file())).rejects.toThrow('Documento bloqueado');
  expect(mock.execute).toHaveBeenCalledTimes(1);
 });
 it('rejeita recibo comum, CNPJ ausente, evidência ausente e CNPJ inventado pela IA',async()=>{
  for(const change of [{documentKind:'OTHER'},{cnpj:null},{cnpjEvidence:null},{}]){
   mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj}]);
   mock.pdf.mockResolvedValue({total:1,text:'DOCUMENTO SEM CNPJ DO CONTRIBUINTE. '.repeat(8)});
   mock.llm.mockResolvedValue({text:JSON.stringify({...exemploPlano,documentKind:'TAX_INSTALLMENT',cnpjEvidence:exemploPlano.cnpj,...change})});
   await expect(extrairParcelamento(company,file())).rejects.toThrow();
  }
  expect(mock.execute).toHaveBeenCalledTimes(4);
 });
 it('revalida o CNPJ persistido no PDF mesmo que o usuário altere o campo na tela',async()=>{
  mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj}]).mockResolvedValueOnce([{source_hash:'hash',source_pdf:'pdf',source_name:'outro.pdf',extracted_data:{validation:{documentKind:'TAX_INSTALLMENT',cnpj:'98765432000199',cnpjEvidence:'98765432000199'}}}]);
  await expect(criarPlanoParcelamento(company,exemploPlano,id,true)).rejects.toThrow('Documento bloqueado');
  expect(mock.execute).toHaveBeenCalledTimes(2);
 });
 it('recusa rascunhos antigos sem validação da identidade do documento',async()=>{
  mock.execute.mockResolvedValueOnce([{cnpj:exemploPlano.cnpj}]).mockResolvedValueOnce([{source_hash:'hash',source_pdf:'pdf',source_name:'termo.pdf',extracted_data:{data:exemploPlano}}]);
  await expect(criarPlanoParcelamento(company,exemploPlano,id,true)).rejects.toThrow('não foi reconhecido');
  expect(mock.execute).toHaveBeenCalledTimes(2);
 });
 it('envia guia oficial atualizando a parcela, com entrega protocolada na mesma transação',async()=>{
  mock.execute.mockResolvedValueOnce([{id,tax_name:'Parcela 3/24',status:'OPEN',file_url:null,dueDate:'2026-09-30',installmentNumber:3}]).mockResolvedValueOnce([]);
  expect(await enviarGuiaParcela(company,id,file(),1025.50,'2026-09-30','pix-mes',null)).toEqual({id:'delivery',protocolo:'HEXX-1'});
  const query=dialect.sqlToQuery(mock.execute.mock.calls[1]![0]);expect(query.sql).toContain('UPDATE tax_guide');expect(query.params).toContain(company);expect(query.params).toContain(id);expect(query.params).toContain(1025.50);expect(mock.delivery).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({taxGuideId:id,origem:'CONTADOR'}));
 });
 it('não substitui guia já enviada, paga ou de outra empresa',async()=>{
  for(const row of [undefined,{status:'PAID',dueDate:'2020-09-30',installmentNumber:3},{status:'OPEN',file_url:'existing',dueDate:'2020-09-30',installmentNumber:3}]){mock.execute.mockResolvedValueOnce(row?[row]:[]);await expect(enviarGuiaParcela(company,id,file(),100,'2026-09-30','',null)).rejects.toThrow();}
  expect(mock.delivery).not.toHaveBeenCalled();
 });
 it('recusa solicitação e envio de guia de mês futuro antes do dia 10',async()=>{
  mock.execute.mockResolvedValueOnce([{dueDate:'2099-10-30',installmentNumber:2}]);
  await expect(solicitarGuiaParcela(company,id)).rejects.toThrow('dia 10');
  mock.execute.mockResolvedValueOnce([{id,tax_name:'Parcela',status:'OPEN',file_url:null,dueDate:'2099-10-30',installmentNumber:2}]);
  await expect(enviarGuiaParcela(company,id,file(),100,'2099-10-30','',null)).rejects.toThrow('dia 10');
  expect(mock.delivery).not.toHaveBeenCalled();expect(mock.execute).toHaveBeenCalledTimes(2);
 });
 it('renomeia somente o plano da empresa sem alterar parcelas ou acordo',async()=>{
  mock.execute.mockResolvedValueOnce([{id,description:'Meu parcelamento federal'}]);
  expect(await renomearParcelamento(company,id,'  Meu parcelamento federal  ')).toEqual({id,description:'Meu parcelamento federal'});
  const q=dialect.sqlToQuery(mock.execute.mock.calls[0]![0]);expect(q.sql).toContain('UPDATE tax_installment_plan SET description');expect(q.params).toContain(company);expect(q.params).toContain(id);expect(q.sql).not.toContain('tax_guide');
  await expect(renomearParcelamento(company,id,'x')).rejects.toThrow('3 e 180');
 });
 it('recusa renomear plano de outra empresa',async()=>{
  mock.execute.mockResolvedValueOnce([]);await expect(renomearParcelamento(company,id,'Novo nome')).rejects.toThrow('nesta empresa');
 });
 it('solicitação mensal é idempotente e restrita à empresa',async()=>{
  mock.execute.mockResolvedValueOnce([{dueDate:'2020-09-30',installmentNumber:3}]).mockResolvedValueOnce([{id}]).mockResolvedValueOnce([{dueDate:'2020-09-30',installmentNumber:3}]).mockResolvedValueOnce([]);
  expect(await solicitarGuiaParcela(company,id)).toEqual({requested:true});expect(await solicitarGuiaParcela(company,id)).toEqual({requested:false});
  const q=dialect.sqlToQuery(mock.execute.mock.calls[1]![0]);expect(q.sql).toContain('requested_at IS NULL');expect(q.params).toContain(company);
 });
});
