'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Search, X } from 'lucide-react';
import { SegmentedTabs, alertaDaAba } from '@/components/ui/SegmentedTabs';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import type { ClienteDaLista } from '@/lib/server/clientes';
import { consultarParteAction } from '../meu-negocio/contratos/contratos-actions';
import { salvarClienteAction, type TarefaRow } from './actions';
import { TarefasTab, type Customer } from './HubRelacionamento';

/**
 * CLIENTES.
 *
 * A lista mostra, de cada cliente, o que importa: quanto faturou em 12 meses,
 * quanto tem a receber e se tem contrato. Clicar abre a ficha. Os clientes
 * nascem sozinhos das notas emitidas; o "Novo cliente" preenche pela Receita.
 */

type Filtro = 'TODOS' | 'CONTRATO' | 'RECEBER' | 'SEM_NOTA';
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const campo =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-hexxa-forest dark:border-white/10 dark:bg-white/5 dark:focus:border-hexxa-lime';

export function formatarDocumento(d: string | null) {
  const x = (d ?? '').replace(/\D/g, '');
  if (x.length === 14) return x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (x.length === 11) return x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return d ?? '';
}

export function ClientesClient({ clientes, tarefas }: { clientes: ClienteDaLista[]; tarefas: TarefaRow[] }) {
  const router = useRouter();
  const [aba, setAba] = useState<'clientes' | 'tarefas'>('clientes');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [novo, setNovo] = useState(false);

  const hoje = new Date().toISOString().slice(0, 10);
  const atrasadas = tarefas.filter((t) => t.status !== 'concluida' && t.prazo && t.prazo < hoje).length;
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const soDigitos = q.replace(/\D/g, '');
    return clientes.filter(
      (c) =>
        (filtro === 'TODOS' ||
          (filtro === 'CONTRATO' && c.contratosAtivos > 0) ||
          (filtro === 'RECEBER' && c.aReceber > 0) ||
          (filtro === 'SEM_NOTA' && !c.ultimaNota)) &&
        (!q || c.nome.toLowerCase().includes(q) || (soDigitos.length >= 3 && (c.documento ?? '').includes(soDigitos))),
    );
  }, [clientes, busca, filtro]);

  const faturado = clientes.reduce((s, c) => s + c.faturado12m, 0);
  const receber = clientes.reduce((s, c) => s + c.aReceber, 0);
  const comContrato = clientes.filter((c) => c.contratosAtivos > 0).length;
  const clientesDasTarefas: Customer[] = clientes.map((c) => ({ id: c.id, name: c.nome, document: c.documento, email: c.email, phone: c.telefone, type: c.tipo, address: null }) as Customer);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <SegmentedTabs
          tabs={[
            { id: 'clientes', label: 'Clientes' },
            { id: 'tarefas', label: 'Tarefas', badge: alertaDaAba(atrasadas) },
          ]}
          activeTab={aba}
          onChange={(id) => setAba(id as 'clientes' | 'tarefas')}
          layoutId="clientesAbas"
        />
        {aba === 'clientes' && (
          <button
            type="button"
            onClick={() => setNovo(true)}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            <Plus className="h-3.5 w-3.5" /> Novo cliente
          </button>
        )}
      </div>

      {aba === 'tarefas' ? (
        <TarefasTab customers={clientesDasTarefas} tarefas={tarefas} onChanged={() => router.refresh()} />
      ) : (
        <>
          <GradeDeResumo colunas={3}>
            <CardResumo destaque rotulo="Faturado em 12 meses" valor={BRL.format(faturado)} nota={`${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'} · só notas fiscais`} />
            <CardResumo rotulo="A receber em aberto" valor={BRL.format(receber)} nota="Parcelas de notas e contratos" onClick={() => setFiltro('RECEBER')} />
            <CardResumo rotulo="Com contrato ativo" valor={comContrato} nota="Clientes com contrato de entrada" onClick={() => setFiltro('CONTRATO')} />
          </GradeDeResumo>

          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <FiltrosEmTexto<Filtro>
                ativo={filtro}
                onChange={setFiltro}
                filtros={[
                  { id: 'TODOS', label: 'Todos', count: clientes.length },
                  { id: 'CONTRATO', label: 'Com contrato', count: comContrato },
                  { id: 'RECEBER', label: 'Com valor a receber', count: clientes.filter((c) => c.aReceber > 0).length },
                  { id: 'SEM_NOTA', label: 'Sem nota', count: clientes.filter((c) => !c.ultimaNota).length },
                ]}
              />
              <label className="flex w-full items-center gap-2 border-b border-black/10 pb-1.5 sm:w-64 dark:border-white/15">
                <Search className="h-3.5 w-3.5 text-ink-soft" />
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome, CPF ou CNPJ" className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft/60" />
              </label>
            </div>

            {lista.length === 0 ? (
              <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
                {clientes.length === 0 ? 'Nenhum cliente ainda. Eles aparecem sozinhos quando você emite notas — ou cadastre um agora.' : 'Ninguém neste filtro.'}
              </p>
            ) : (
              <ul className="divide-y divide-black/5 overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
                {lista.map((c) => (
                  <li key={c.id}>
                    <Link href={`/relacionamento/${c.id}` as Route} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{c.nome}</p>
                        <p className="mt-0.5 text-xs text-ink-soft">
                          {formatarDocumento(c.documento) || 'Sem documento'}
                          {c.contratosAtivos > 0 ? ` · ${c.contratosAtivos} ${c.contratosAtivos === 1 ? 'contrato' : 'contratos'}` : ''}
                          {c.ultimaNota ? ` · última nota em ${new Date(c.ultimaNota).toLocaleDateString('pt-BR')}` : ''}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(c.faturado12m)}</p>
                        <p className={`text-[11px] ${c.aReceber > 0 ? 'font-semibold text-amber-700 dark:text-amber-400' : 'text-ink-soft'}`}>
                          {c.aReceber > 0 ? `${BRL.format(c.aReceber)} a receber` : 'em 12 meses'}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {novo && (
        <FormularioDeCliente
          onClose={() => setNovo(false)}
          onDone={(id) => {
            setNovo(false);
            router.push(`/relacionamento/${id}` as Route);
          }}
        />
      )}
    </div>
  );
}

/** Novo cliente ou edição. Com o CNPJ completo, preenche nome, endereço e e-mail pela Receita. */
export function FormularioDeCliente({
  inicial,
  onClose,
  onDone,
}: {
  inicial?: { id: string; nome: string; documento: string | null; email: string | null; telefone: string | null; endereco: string | null };
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const [documento, setDocumento] = useState(formatarDocumento(inicial?.documento ?? ''));
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [email, setEmail] = useState(inicial?.email ?? '');
  const [telefone, setTelefone] = useState(inicial?.telefone ?? '');
  const [endereco, setEndereco] = useState(inicial?.endereco ?? '');
  const [consultando, setConsultando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const d = documento.replace(/\D/g, '');
    if (d.length !== 14 || inicial) return;
    let vivo = true;
    setConsultando(true);
    consultarParteAction(d)
      .then((r) => {
        if (!vivo || !r.ok) return;
        setNome(r.nome);
        if (r.endereco) setEndereco(r.endereco);
        if (r.email) setEmail((e) => e || r.email!);
      })
      .finally(() => vivo && setConsultando(false));
    return () => {
      vivo = false;
    };
  }, [documento, inicial]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const r = await salvarClienteAction({ id: inicial?.id, nome, documento, email, telefone, endereco });
      if (!r.ok) return setErro(r.message);
      onDone(r.id!);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-black/5 bg-surface p-6 shadow-(--elev-3) dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="rotulo text-ink-soft">{inicial ? 'Editar cliente' : 'Novo cliente'}</p>
            <h2 className="mt-1 text-lg font-light uppercase tracking-[0.05em] text-ink">{nome || 'Cliente'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="rotulo text-ink-soft">CNPJ ou CPF</span>
            <input value={documento} onChange={(e) => setDocumento(formatarDocumento(e.target.value.replace(/\D/g, '').slice(0, 14)) || e.target.value)} inputMode="numeric" className={campo} />
          </label>
          <label className="block">
            <span className="rotulo text-ink-soft">Telefone</span>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} inputMode="tel" className={campo} />
          </label>
          <label className="block sm:col-span-2">
            <span className="rotulo text-ink-soft">Nome ou razão social</span>
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
          </label>
          <label className="block sm:col-span-2">
            <span className="rotulo text-ink-soft">E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
          </label>
          <label className="block sm:col-span-2">
            <span className="rotulo text-ink-soft">Endereço</span>
            <input value={endereco} onChange={(e) => setEndereco(e.target.value)} className={campo} />
          </label>
        </div>
        {consultando && <p className="mt-3 text-xs text-ink-soft">Consultando a Receita…</p>}
        {erro && <p className="mt-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-3 text-sm font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
        >
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />} {inicial ? 'Salvar' : 'Cadastrar cliente'}
        </button>
      </div>
    </div>
  );
}
