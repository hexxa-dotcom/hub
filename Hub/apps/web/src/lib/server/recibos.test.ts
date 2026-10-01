import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
const mocked = vi.hoisted(() => ({ execute: vi.fn(), tenant: vi.fn(), pdf: vi.fn() }));
vi.mock('@hexxa/db', async () => ({
  sql: (await import('drizzle-orm')).sql,
  withTenant: mocked.tenant,
  getDb: () => ({ execute: mocked.execute }),
}));
vi.mock('./recibo-aluguel', () => ({ gerarPdfReciboAluguel: mocked.pdf }));
import { emitirRecibo, salvarDiscriminacao, consultarReciboPublico, configurarAssinaturaRecibos } from './recibos';

const companyId = '11111111-1111-4111-8111-111111111111';
const entryId = '22222222-2222-4222-8222-222222222222';
const receiptId = '33333333-3333-4333-8333-333333333333';
const ctx = { companyId, companyType: 'SERVICE' as const, userId: 'test' };
const paid = { company_type: 'SERVICE', source: 'NFSE', type: 'RECEIVABLE', status: 'PAID',
  payment_date: '2026-09-29', amount: '3800.00', month: '2026-09-01', due: '2026-09-30',
  legal_name: 'Emissor', cnpj: '12345678000195', company_address: 'Endereço', payer: 'Cliente',
  invoice_number: '124', invoice_status: 'ISSUED', description: 'Consultoria', owner_type: null };
const dialect = new PgDialect();

beforeEach(() => {
  vi.clearAllMocks();
  mocked.tenant.mockImplementation((_id, fn) => fn({ execute: mocked.execute }));
  mocked.pdf.mockResolvedValue(Buffer.from('%PDF-documento'));
});
describe('Emissão de recibos', () => {
  it('preserva o PDF, vincula a nota e não cria outro lançamento ou envio fiscal', async () => {
    mocked.execute.mockResolvedValueOnce([paid]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const result = await emitirRecibo(ctx, entryId);
    expect(result.alreadyIssued).toBe(false);
    expect(mocked.tenant).toHaveBeenCalledWith(companyId,expect.any(Function));
    expect(mocked.pdf).toHaveBeenCalledWith(expect.objectContaining({ notaFiscal: '124', tipo: 'PAGAMENTO', dataPagamento: '29/09/2026' }));
    const queries = mocked.execute.mock.calls.map(([q]) => dialect.sqlToQuery(q));
    expect(queries[0]!.sql).toContain('FOR UPDATE OF fe');
    expect(queries[0]!.params).toContain(companyId);
    expect(queries[2]!.sql).toContain('INSERT INTO payment_receipt');
    expect(queries[2]!.params).toContain('NAO_APLICAVEL');
    expect(queries.some(q => /INSERT INTO financial_entry|UPDATE financial_entry/.test(q.sql))).toBe(false);
  });
  it('retorna o documento existente sem gerar PDF ou segunda emissão', async () => {
    mocked.execute.mockResolvedValueOnce([paid]).mockResolvedValueOnce([{ id: receiptId, canceled_at: null }]);
    expect(await emitirRecibo(ctx,entryId)).toEqual({ id: receiptId, alreadyIssued: true });
    expect(mocked.pdf).not.toHaveBeenCalled();
    expect(mocked.execute).toHaveBeenCalledTimes(2);
  });
  it('recusa lançamento de outra empresa, pagamento pendente e recibo cancelado', async () => {
    mocked.execute.mockResolvedValueOnce([]);
    await expect(emitirRecibo(ctx,entryId)).rejects.toThrow('nesta empresa');
    mocked.execute.mockResolvedValueOnce([{ ...paid, status: 'PENDING', payment_date: null }]).mockResolvedValueOnce([]);
    await expect(emitirRecibo(ctx,entryId)).rejects.toThrow('Registre o pagamento');
    mocked.execute.mockResolvedValueOnce([paid]).mockResolvedValueOnce([{ id: receiptId, canceled_at: '2026-09-30' }]);
    await expect(emitirRecibo(ctx,entryId)).rejects.toThrow('cancelado');
    expect(mocked.pdf).not.toHaveBeenCalled();
  });
  it('marca apenas aluguel de bem PJ da holding como elegível, ainda sem enviar', async () => {
    mocked.execute.mockResolvedValueOnce([{ ...paid, company_type:'HOLDING', source:'RENT', property_label:'Imóvel', owner_type:'PJ' }]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await emitirRecibo({ ...ctx,companyType:'HOLDING' },entryId);
    expect(dialect.sqlToQuery(mocked.execute.mock.calls[2]![0]).params).toContain('AGUARDANDO_CONFIGURACAO');
  });
});

it('recusa vínculo de despesa de outra empresa antes de salvar',async()=>{
 mocked.execute.mockResolvedValueOnce([{amount:100}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
 await expect(salvarDiscriminacao(ctx,entryId,[{descricao:'Condomínio',valor:100,despesaId:receiptId}])).rejects.toThrow('não pertence');
 const q=dialect.sqlToQuery(mocked.execute.mock.calls[2]![0]);
 expect(q.sql).toContain('company_id=');expect(q.params).toContain(companyId);
 expect(mocked.execute).toHaveBeenCalledTimes(3);
});
it('QR guarda token aleatório e consulta por hash, inclusive cancelados',async()=>{
 mocked.execute.mockResolvedValueOnce([paid]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
 await emitirRecibo(ctx,entryId);
 const data=mocked.pdf.mock.calls[0]![0];
 const token=data.urlVerificacao.split('/').at(-1);
 expect(token).toMatch(/^[a-f0-9]{64}$/);
 const insert=dialect.sqlToQuery(mocked.execute.mock.calls[2]![0]);
 expect(insert.sql).toContain('verification_hash');
 expect(insert.params).not.toContain(token);
 mocked.execute.mockResolvedValueOnce([{number:'REC-X',canceled:true}]);
 expect(await consultarReciboPublico(token)).toMatchObject({canceled:true});
 const query=dialect.sqlToQuery(mocked.execute.mock.calls[3]![0]);
 expect(query.sql).toContain("fe.status<>'PAID'");
 expect(query.params).not.toContain(token);
 const calls=mocked.execute.mock.calls.length;
 expect(await consultarReciboPublico('123')).toBeNull();
 expect(mocked.execute).toHaveBeenCalledTimes(calls);
});

it('assina apenas com autorização vigente e preserva a assinatura no snapshot',async()=>{
 mocked.execute.mockResolvedValueOnce([{...paid,signature_authorization_id:receiptId,signer_name:'Responsável'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
 await emitirRecibo(ctx,entryId);
 const snapshot=mocked.pdf.mock.calls[0]![0];
 expect(snapshot.assinatura).toMatchObject({metodo:'HUB',nome:'Responsável',autorizacaoId:receiptId});
 expect(snapshot.assinatura.conteudoHash).toMatch(/^[a-f0-9]{64}$/);
 const insert=dialect.sqlToQuery(mocked.execute.mock.calls[2]![0]);
 expect(insert.sql).toContain('snapshot_hash');
 expect(insert.sql).toContain('pdf_hash');
});
it('não usa a autorização da holding para assinar por proprietário pessoa física',async()=>{
 mocked.execute.mockResolvedValueOnce([{...paid,source:'RENT',owner_type:'PF',owner_name:'Sócio',property_label:'Imóvel',signature_authorization_id:receiptId,signer_name:'Responsável'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
 await emitirRecibo(ctx,entryId);
 expect(mocked.pdf.mock.calls[0]![0].assinatura).toBeUndefined();
});
it('exige login pessoal, proprietário aprovado e consentimento para autorizar',async()=>{
 await expect(configurarAssinaturaRecibos(ctx,true,true,{ip:null,userAgent:null})).rejects.toThrow('usuário pessoal');
 const ownerCtx={...ctx,userId:receiptId};
 mocked.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
 await expect(configurarAssinaturaRecibos(ownerCtx,true,true,{ip:null,userAgent:null})).rejects.toThrow('Somente o responsável');
 mocked.execute.mockResolvedValueOnce([]).mockResolvedValueOnce([{name:'Responsável',cpf:'12345678901',email:'demo@example.com'}]);
 await expect(configurarAssinaturaRecibos(ownerCtx,true,false,{ip:null,userAgent:null})).rejects.toThrow('Confirme');
});
it('consulta pública invalida PDF alterado e nunca expõe sua base64',async()=>{
 mocked.execute.mockResolvedValueOnce([{number:'REC-X',issuer:'Empresa',reference:'09/2026',amount:100,paid:'30/09/2026',canceled:false,pdf_base64:Buffer.from('alterado').toString('base64'),pdf_hash:'a'.repeat(64)}]);
 const result=await consultarReciboPublico('a'.repeat(64));
 expect(result?.canceled).toBe(true);
 expect(result).not.toHaveProperty('pdf_base64');
});

it('confere o snapshot assinado mesmo com chaves reordenadas e recusa alteração do signatário',async()=>{
 mocked.execute.mockResolvedValueOnce([{...paid,signature_authorization_id:receiptId,signer_name:'Responsável'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
 await emitirRecibo(ctx,entryId);
 const data=mocked.pdf.mock.calls[0]![0];
 const params=dialect.sqlToQuery(mocked.execute.mock.calls[2]![0]).params;
 const hashes=params.filter((v:unknown)=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v as string));
 const snapshot=Object.fromEntries(Object.entries(JSON.parse(JSON.stringify(data))).reverse());
 const row={number:'REC-X',issuer:'Empresa',reference:'09/2026',amount:3800,paid:'30/09/2026',canceled:false,
   snapshot,signature:data.assinatura,pdf_base64:Buffer.from('%PDF-documento').toString('base64'),pdf_hash:hashes[1],snapshot_hash:hashes[2]};
 mocked.execute.mockResolvedValueOnce([row]);
 const valid=await consultarReciboPublico('a'.repeat(64));
 expect(valid?.canceled).toBe(false);expect(valid?.signature?.name).toBe('Responsável');
 mocked.execute.mockResolvedValueOnce([{...row,snapshot:{...snapshot,assinatura:{...data.assinatura,nome:'Outro'}}}]);
 const changed=await consultarReciboPublico('a'.repeat(64));
 expect(changed?.canceled).toBe(true);expect(changed?.signature).toBeNull();
});

it('permite emitir sem assinatura mesmo com autorização automática ativa',async()=>{
 mocked.execute.mockResolvedValueOnce([{...paid,signature_authorization_id:receiptId,signer_name:'Responsável'}]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
 await emitirRecibo(ctx,entryId,undefined,false);
 expect(mocked.pdf.mock.calls[0]![0].assinatura).toBeUndefined();
});
it('recusa pedido explícito de assinatura sem autorização',async()=>{
 mocked.execute.mockResolvedValueOnce([paid]).mockResolvedValueOnce([]);
 await expect(emitirRecibo(ctx,entryId,undefined,true)).rejects.toThrow('autorização vigente');
 expect(mocked.pdf).not.toHaveBeenCalled();
});
