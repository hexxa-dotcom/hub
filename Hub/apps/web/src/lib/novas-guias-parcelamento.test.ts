import {describe,it,expect} from 'vitest';
import {novasGuiasParcelamento} from './novas-guias-parcelamento';
const guia={id:'parcela',installmentGroupId:'plano',fileUrl:'pdf',status:'OPEN'};
const entrega={taxGuideId:'parcela',temArquivo:true,visualizadoEm:null,confirmadoEm:null};
describe('novas guias de parcelamento',()=>{
 it('conta somente PDFs entregues e ainda não consultados, uma vez por parcela',()=>{
  expect(novasGuiasParcelamento([guia,guia],[entrega,entrega])).toEqual(['parcela']);
 });
 it('não avisa sobre previsões, guias avulsas, parcelas pagas ou sem entrega',()=>{
  for(const g of [{...guia,fileUrl:null},{...guia,installmentGroupId:null},{...guia,status:'PAID'}])expect(novasGuiasParcelamento([g],[entrega])).toEqual([]);
  expect(novasGuiasParcelamento([guia],[])).toEqual([]);
  expect(novasGuiasParcelamento([guia],[{...entrega,temArquivo:false}])).toEqual([]);
 });
 it('retira o indicador após abertura/baixa ou confirmação',()=>{
  expect(novasGuiasParcelamento([guia],[{...entrega,visualizadoEm:'2026-09-30'}])).toEqual([]);
  expect(novasGuiasParcelamento([guia],[{...entrega,confirmadoEm:'2026-09-30'}])).toEqual([]);
 });
 it('não associa a entrega a outra parcela',()=>{
  expect(novasGuiasParcelamento([guia],[{...entrega,taxGuideId:'outra'}])).toEqual([]);
 });
});
