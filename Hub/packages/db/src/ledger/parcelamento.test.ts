import {it,expect,vi} from 'vitest';
import {escriturarGuia} from './escrituracao';
import type {DbHandle} from '../client';
it('parcelamento gerenciado não reprovisiona débito antigo como despesa tributária nova',async()=>{
 const where=vi.fn().mockResolvedValue([{id:'guide',installmentManaged:true}]);
 const from=vi.fn(()=>({where}));const select=vi.fn(()=>({from}));const execute=vi.fn();const insert=vi.fn();
 const db={select,execute,insert} as unknown as DbHandle;
 const result=await escriturarGuia(db,'company','guide');
 expect(execute).not.toHaveBeenCalled();expect(insert).not.toHaveBeenCalled();expect(result.erros).toEqual([]);
});
