import { describe, it, expect } from 'vitest';
import { itensDoRecebimento, validarDiscriminacao, validarRecibo, reciboPodeApurar, dataReciboValida, proximaDataRecibo, type RegraRecibo } from './recibo-rules';

const received: RegraRecibo = { companyType: 'HOLDING', source: 'RENT', ownerType: 'PJ', type: 'RECEIVABLE', status: 'PAID', paidAt: '2026-09-29', amount: 3800 };
describe('Recibo: comprovação e exceção das holdings', () => {
  it('aceita apenas recebimentos pagos com data e valor válidos', () => {
    expect(validarRecibo(received)).toBeNull();
    for (const patch of [{ status: 'PENDING' }, { status: 'CANCELED' }, { type: 'PAYABLE' }, { paidAt: null }, { amount: 0 }, { amount: NaN }]) {
      expect(validarRecibo({ ...received, ...patch })).not.toBeNull();
    }
  });
  it('somente aluguel pago de bem da holding é elegível para apuração', () => {
    expect(reciboPodeApurar(received)).toBe(true);
    for (const patch of [{ companyType: 'SERVICE' }, { companyType: 'MEI' }, { source: 'NFSE' }, { source: 'MANUAL' }, { ownerType: 'PF' }, { ownerType: null }, { status: 'PENDING' }]) {
      expect(reciboPodeApurar({ ...received, ...patch })).toBe(false);
    }
  });
  it('valida datas reais e mantém o dia escolhido nos meses curtos', () => {
    expect(dataReciboValida('2026-02-31')).toBe(false);
    expect(dataReciboValida('2026-02-28')).toBe(true);
    expect(dataReciboValida('x')).toBe(false);
    expect(proximaDataRecibo('2026-01-31',31)).toBe('2026-02-28');
    expect(proximaDataRecibo('2026-02-28',31)).toBe('2026-03-31');
    expect(proximaDataRecibo('2026-12-05',5)).toBe('2027-01-05');
    expect(proximaDataRecibo('2028-01-31',31)).toBe('2028-02-29');
  });
});

describe('Discriminação do pagamento',()=>{
 it('puxa juros e desconto sem duplicar valores',()=>{
  const items=itensDoRecebimento({amount:103,interest:5,discount:2,description:'Aluguel'});
  expect(items.map(i=>i.valor)).toEqual([100,5,2]);
  expect(items[2]?.desconto).toBe(true);
 });
 it('recusa totais diferentes, centavos inválidos e despesa duplicada',()=>{
  expect(()=>validarDiscriminacao([{descricao:'Aluguel',valor:100}],101)).toThrow('exatamente');
  expect(()=>validarDiscriminacao([{descricao:'Aluguel',valor:1.001}],1)).toThrow('decimais');
  const item={descricao:'Condomínio',valor:10,despesaId:'11111111-1111-4111-8111-111111111111'};
  expect(()=>validarDiscriminacao([item,item],20)).toThrow('duas vezes');
 });
});
