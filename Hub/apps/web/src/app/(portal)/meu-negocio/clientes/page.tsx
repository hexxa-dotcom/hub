import { Users, FileText, Handshake, Eye } from 'lucide-react';
import { CustomerForm } from './CustomerForm';
import { createRawClient } from '@/lib/supabase/server';
import { getTenantContext } from '@/lib/server/tenant';

export const dynamic = 'force-dynamic';

type Customer = {
  id: string;
  name: string;
  document: string;
  email: string | null;
  phone: string | null;
  type: string;
  address: string | null;
};

export default async function Page() {
  let clientes: Customer[] = [
    {
      id: '5e5de2b6-874c-4a43-9879-9d47e4251d1e',
      name: 'João Silva',
      document: '111.222.333-44',
      email: 'joao@email.com',
      phone: null,
      type: 'PF',
      address: null,
    },
    {
      id: '6c96a4f3-eedb-43f4-8477-bef57246a6f8',
      name: 'Maria Santos',
      document: '555.666.777-88',
      email: 'maria@email.com',
      phone: null,
      type: 'PF',
      address: null,
    },
  ];
  let dbReady = true;
  try {
    const ctx = await getTenantContext();
    const supabase = await createRawClient();
    const { data, error } = await supabase
      .from('customer')
      .select('id, name, document, email, phone, type, address')
      .eq('company_id', ctx.companyId)
      .order('created_at', { ascending: false });
    if (!error && data?.length) {
      clientes = (data ?? []) as Customer[];
    }
  } catch {
    dbReady = false;
  }

  return (
    <div className="mx-auto w-full space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Cadastro de Clientes</h1>
        <p className="mt-0.5 text-sm text-ink-soft">
          Gerencie seus clientes aqui. Eles serão usados para emitir NFSe, gerar contratos, contas a receber e muito mais.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card icon={Users} label="Total de clientes" value={clientes.length} />
        <Card icon={FileText} label="Pronto pra NFSe" value={clientes.length} />
        <Card icon={Handshake} label="Contratos" value="0" hint="em breve" />
      </div>

      <CustomerForm />

      {!dbReady && (
        <p className="card-flat rounded-card p-4 text-sm text-warn">Não foi possível conectar ao banco agora.</p>
      )}

      <section className="card-flat rounded-card p-5">
        <h2 className="text-lg font-semibold">Clientes cadastrados</h2>
        {clientes.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">Nenhum cliente cadastrado ainda. Preencha o formulário acima.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-soft">
                  <th className="py-2">Nome</th>
                  <th>Documento</th>
                  <th>E-mail</th>
                  <th>Telefone</th>
                  <th className="text-center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {clientes.map((c) => (
                  <tr key={c.id} className="border-t border-line">
                    <td className="py-2 font-medium">{c.name}</td>
                    <td className="text-ink-soft">{c.document}</td>
                    <td className="text-ink-soft">{c.email ?? '—'}</td>
                    <td className="text-ink-soft">{c.phone ?? '—'}</td>
                    <td className="text-center">
                      <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-500/20 dark:text-brand-400">
                        <Eye className="h-3.5 w-3.5" /> Ver
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card-flat rounded-card p-5 text-sm text-ink-soft">
        <h2 className="text-base font-semibold text-ink">Próximas integrações</h2>
        <ul className="mt-2 space-y-1.5">
          <li>✓ Clientes alimentam a emissão de NFSe (já funciona)</li>
          <li>◇ Gerar contrato de prestação de serviço automático</li>
          <li>◇ Criar conta a receber ao emitir NFSe</li>
          <li>◇ Histórico de transações por cliente</li>
          <li>◇ Importar clientes de CSV</li>
        </ul>
      </section>
    </div>
  );
}

function Card({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <div className="card-flat rounded-card p-4">
      <div className="flex items-start justify-between">
        <h3 className="text-sm text-ink-soft">{label}</h3>
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
      {hint && <p className="text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
