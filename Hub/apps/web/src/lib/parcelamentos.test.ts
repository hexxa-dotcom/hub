import {describe,it,expect} from 'vitest';
import {planoSchema,montarParcelas,vencimentoParcela,resumoParcelamento,exemploPlano,type Parcela,filtrarParcelas,guiaLiberada,ultimoDiaUtilFederal,ajustarVencimentosPrevistos} from './parcelamentos';
describe('Programação de parcelamentos',()=>{
 it('conserva o dia nos meses seguintes e limita fevereiro sem pular parcela',()=>{
  expect([0,1,2].map(i=>vencimentoParcela('2026-01-31',i))).toEqual(['2026-01-31','2026-02-28','2026-03-31']);
  expect(vencimentoParcela('2028-01-31',1)).toBe('2028-02-29');
 });
 it('separa entrada e parcelas futuras e só marca o histórico informado',()=>{
  const rows=montarParcelas({...exemploPlano,firstAmount:2000},'2026-09-30');
  expect(rows).toHaveLength(24);expect(rows[0]?.amount).toBe(2000);expect(rows[1]?.amount).toBe(1000);
  expect(rows.filter(p=>p.status==='PAID')).toHaveLength(2);expect(rows[2]?.dueDate).toBe('2026-09-30');expect(rows[2]?.status).toBe('OPEN');
 });
 it('recusa datas impossíveis, quantidades fracionadas, excesso de pagas e valores inválidos',()=>{
  for(const patch of [{firstDueDate:'2026-02-30'},{installmentCount:2.5},{paidCount:25},{installmentAmount:NaN},{firstAmount:1.001},{cnpj:'123'}])expect(planoSchema.safeParse({...exemploPlano,...patch}).success).toBe(false);
 });
 it('consulta conta parcelas restantes e prioriza a parcela do mês',()=>{
  const rows=montarParcelas({...exemploPlano,paidCount:1},'2026-09-30').map(p=>({...p,id:String(p.number),taxName:'Parcelamento',fileUrl:null,pixCode:null,installmentGroupId:'demo',installmentNumber:p.number,installmentCount:24})) as Parcela[];
  const s=resumoParcelamento(rows,'2026-09-30');expect(s.paid).toBe(1);expect(s.remaining).toBe(23);expect(s.balance).toBe(23000);expect(s.current?.installmentNumber).toBe(3);
 });
});

describe('Consulta e calendário de parcelamentos',()=>{
 const rows=montarParcelas({...exemploPlano,installmentCount:60,paidCount:0},'2026-09-30').map(p=>({...p,id:String(p.number),taxName:'Parcelamento',fileUrl:null,pixCode:null,installmentGroupId:'demo',installmentNumber:p.number,installmentCount:60,installmentEstimated:true})) as Parcela[];
 it('limita em 12, filtra o ano corrente e mantém os totais calculados nas 60',()=>{
  expect(filtrarParcelas(rows,'primeiras12','2026-09-30')).toHaveLength(12);
  expect(filtrarParcelas(rows,'ano','2026-09-30')).toHaveLength(6);
  expect(filtrarParcelas(rows,'todas','2026-09-30')).toHaveLength(60);
  expect(resumoParcelamento(rows,'2026-09-30').remaining).toBe(60);
 });
 it('libera no dia 10, bloqueia meses futuros e preserva a primeira parcela',()=>{
  expect(guiaLiberada({dueDate:'2026-10-30',installmentNumber:2},'2026-10-09')).toBe(false);
  expect(guiaLiberada({dueDate:'2026-10-30',installmentNumber:2},'2026-10-10')).toBe(true);
  expect(guiaLiberada({dueDate:'2026-11-30',installmentNumber:2},'2026-10-30')).toBe(false);
  expect(guiaLiberada({dueDate:'2026-10-05',installmentNumber:1},'2026-10-01')).toBe(true);
 });
 it('prevê o último dia útil federal sem alterar a primeira parcela',()=>{
  expect(ultimoDiaUtilFederal('2026-10')).toBe('2026-10-30');
  expect(ultimoDiaUtilFederal('2027-02')).toBe('2027-02-26');
  expect(ultimoDiaUtilFederal('2024-02')).toBe('2024-02-29');
  // Em 2028 o dia 29/02 é terça-feira de Carnaval.
  expect(ultimoDiaUtilFederal('2028-02')).toBe('2028-02-25');
  expect(ultimoDiaUtilFederal('2026-12')).toBe('2026-12-30');
  expect(ultimoDiaUtilFederal('2017-02')).toBe('2017-02-24');
  expect(ultimoDiaUtilFederal('2018-03')).toBe('2018-03-29');
  const plan=montarParcelas({...exemploPlano,firstDueDate:'2026-09-25',paidCount:0},'2026-09-30');
  expect(plan[0]?.dueDate).toBe('2026-09-25');expect(plan[1]?.dueDate).toBe('2026-10-30');
 });
 it('preserva guia oficial, pagamentos históricos e planos não federais',()=>{
  const meta={id:'demo',description:'Plano',authority:'RFB',tax:'Federal',agreement:'A',totalAmount:1000,sourceName:null};
  const base={...rows[1]!,dueDate:'2026-10-25'};
  expect(ajustarVencimentosPrevistos([base],[meta],'2026-09-30')[0]?.dueDate).toBe('2026-10-30');
  for(const patch of [{fileUrl:'pdf'},{status:'PAID' as const},{installmentEstimated:false}])expect(ajustarVencimentosPrevistos([{...base,...patch}],[meta],'2026-09-30')[0]?.dueDate).toBe('2026-10-25');
  expect(ajustarVencimentosPrevistos([base],[{...meta,authority:'Prefeitura',tax:'ISS'}],'2026-09-30')[0]?.dueDate).toBe('2026-10-25');
 });
});
