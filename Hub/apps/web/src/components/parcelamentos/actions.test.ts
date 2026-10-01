import {beforeEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({tenant:vi.fn(),admin:vi.fn(),create:vi.fn(),list:vi.fn(),extract:vi.fn(),rename:vi.fn()}));
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}));
vi.mock('@/lib/server/tenant',()=>({getTenantContext:m.tenant}));
vi.mock('@/lib/server/admin-guard',()=>({requireAdmin:m.admin,adminUserId:async()=>null}));
vi.mock('@/lib/server/parcelamentos',()=>({extrairParcelamento:m.extract,criarPlanoParcelamento:m.create,listarParcelamentos:m.list,solicitarGuiaParcela:vi.fn(),enviarGuiaParcela:vi.fn(),renomearParcelamento:m.rename}));
import {criarPlanoAction,lerParcelamentoAction,renomearPlanoAction} from './actions';
import {exemploPlano} from '@/lib/parcelamentos';
beforeEach(()=>{vi.clearAllMocks();m.tenant.mockResolvedValue({companyId:'tenant-do-login'});m.admin.mockResolvedValue(undefined);m.create.mockResolvedValue({id:'plano',existing:false});m.list.mockResolvedValue({plans:[],guides:[]});});
it('o cliente não escolhe outra empresa no payload',async()=>{
 const r=await criarPlanoAction('cliente','11111111-1111-4111-8111-111111111111',exemploPlano,undefined,true);
 expect(r.ok).toBe(true);expect(m.create).toHaveBeenCalledWith('tenant-do-login',exemploPlano,undefined,true);expect(m.admin).not.toHaveBeenCalled();
});
it('bloqueia leitura e gravação administrativa antes de acessar o serviço',async()=>{
 m.admin.mockRejectedValue(new Error('Não autorizado.'));
 expect((await lerParcelamentoAction('contador','11111111-1111-4111-8111-111111111111',new FormData())).ok).toBe(false);
 expect((await criarPlanoAction('contador','11111111-1111-4111-8111-111111111111',exemploPlano)).ok).toBe(false);
 expect(m.extract).not.toHaveBeenCalled();expect(m.create).not.toHaveBeenCalled();
});

it('oculta SQL e conteúdo do PDF quando o banco não está atualizado',async()=>{
 const failure=new Error('Failed query: INSERT ... params: data:application/pdf;base64,conteudo-privado');
 Object.assign(failure,{cause:{code:'42P01'}});m.extract.mockRejectedValueOnce(failure);
 const r=await lerParcelamentoAction('cliente',undefined,new FormData());
 expect(r.ok).toBe(false);if(!r.ok){expect(r.message).toContain('atualização do banco');expect(r.message).not.toMatch(/INSERT|base64|conteudo-privado/);}
});
it('oculta parâmetros internos em falhas inesperadas da leitura',async()=>{
 m.extract.mockRejectedValueOnce(new Error('Failed query: SELECT ... params: segredos'));
 const r=await lerParcelamentoAction('cliente',undefined,new FormData());
 expect(r.ok).toBe(false);if(!r.ok)expect(r.message).not.toMatch(/SELECT|params|segredos/);
});

it('renomear usa a empresa do login e exige autorização na área do contador',async()=>{
 m.rename.mockResolvedValueOnce({id:'plano',description:'Meu plano'});
 expect((await renomearPlanoAction('cliente','outra-empresa','plano','Meu plano')).ok).toBe(true);
 expect(m.rename).toHaveBeenCalledWith('tenant-do-login','plano','Meu plano');
 m.admin.mockRejectedValueOnce(new Error('Não autorizado.'));
 expect((await renomearPlanoAction('contador','11111111-1111-4111-8111-111111111111','plano','Meu plano')).ok).toBe(false);
 expect(m.rename).toHaveBeenCalledTimes(1);
});
