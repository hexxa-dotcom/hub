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
import { salvarClienteAction, marcarRecorrenciaAction, type TarefaRow } from './actions';
import { TarefasTab } from './TarefasTab';
import { nomeDeExibicao, iniciais } from '@/lib/nome-de-exibicao';
import { relacaoDoCliente, ROTULO_DA_RELACAO, COR_DA_RELACAO, type Relacao } from '@/lib/relacao-cliente';
import { Mail, MessageCircle } from 'lucide-react';
import { ListaEmColunas, Titulo, Valor, Situacao, BotaoDiscreto, Campo, Detalhe } from '@/components/ui/ListaEmColunas';

/**
 * CLIENTES.
 *
 * A lista mostra, de cada cliente, o que importa: quanto faturou em 12 meses,
 * quanto tem a receber e se tem contrato. Clicar abre a ficha. Os clientes
 * nascem sozinhos das notas emitidas; o "Novo cliente" preenche pela Receita.
 */

type Filtro = 'TODOS' | 'RECORRENTE' | 'AVULSO' | 'INATIVO' | 'RECEBER';

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
          (filtro !== 'RECEBER' && relacaoDoCliente(c) === filtro) ||
          (filtro === 'RECEBER' && c.aReceber > 0)) &&
        (!q || (c.nome.toLowerCase().includes(q) || nomeDeExibicao(c.nome).toLowerCase().includes(q)) || (soDigitos.length >= 3 && (c.documento ?? '').includes(soDigitos))),
    );
  }, [clientes, busca, filtro]);

  const faturado = clientes.reduce((s, c) => s + c.faturado12m, 0);
  const receber = clientes.reduce((s, c) => s + c.aReceber, 0);
  const comContrato = clientes.filter((c) => c.contratosAtivos > 0).length;
  const porRelacao = clientes.reduce((m, c) => ({ ...m, [relacaoDoCliente(c)]: m[relacaoDoCliente(c)] + 1 }), { RECORRENTE: 0, AVULSO: 0, INATIVO: 0 } as Record<Relacao, number>);

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
        <TarefasTab clientes={clientes.map((c) => ({ id: c.id, nome: c.nome }))} tarefas={tarefas} onChanged={() => router.refresh()} />
      ) : (
        <>
          <GradeDeResumo colunas={3}>
            <CardResumo destaque rotulo="Faturado em 12 meses" valor={BRL.format(faturado)} nota={`${porRelacao.RECORRENTE} ${porRelacao.RECORRENTE === 1 ? 'recorrente' : 'recorrentes'} · ${porRelacao.AVULSO} ${porRelacao.AVULSO === 1 ? 'avulso' : 'avulsos'} · só notas fiscais`} />
            <CardResumo rotulo="A receber em aberto" valor={BRL.format(receber)} nota="Parcelas de notas e contratos" onClick={() => setFiltro('RECEBER')} />
            <CardResumo rotulo="Clientes recorrentes" valor={porRelacao.RECORRENTE} nota={comContrato ? `${comContrato} com contrato ativo` : 'Nota em 3 dos últimos 4 meses'} onClick={() => setFiltro('RECORRENTE')} />
          </GradeDeResumo>

          <section className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <FiltrosEmTexto<Filtro>
                ativo={filtro}
                onChange={setFiltro}
                filtros={[
                  { id: 'TODOS', label: 'Todos', count: clientes.length },
                  { id: 'RECORRENTE', label: 'Recorrentes', count: porRelacao.RECORRENTE },
                  { id: 'AVULSO', label: 'Avulsos', count: porRelacao.AVULSO },
                  { id: 'INATIVO', label: 'Inativos', count: porRelacao.INATIVO },
                  { id: 'RECEBER', label: 'Com valor a receber', count: clientes.filter((c) => c.aReceber > 0).length },
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
              <ListaDeClientes clientes={lista} />
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

/**
 * A lista de clientes no padrão das listas (ListaEmColunas): o cliente com o
 * nome legível, a relação, quanto faturou, quanto tem a receber e a última
 * nota. O primeiro clique abre os detalhes; "Abrir ficha" leva à ficha.
 */
function ListaDeClientes({ clientes }: { clientes: ClienteDaLista[] }) {
  return (
    <ListaEmColunas
      colunas={[
        { rotulo: 'Cliente', largura: 'minmax(0,1fr)' },
        { rotulo: 'Relação', largura: '7rem', soDesktop: true },
        { rotulo: 'Faturado 12m', largura: '8rem', alinhar: 'direita' },
        { rotulo: 'A receber', largura: '8rem', alinhar: 'direita', soDesktop: true },
        { rotulo: 'Última nota', largura: '7rem', alinhar: 'direita', soDesktop: true },
      ]}
      itens={clientes}
      chave={(c) => c.id}
      celulas={(c) => {
        const nome = nomeDeExibicao(c.nome);
        const relacao = relacaoDoCliente(c);
        return [
          <Titulo
            key="t"
            nome={nome}
            monograma={iniciais(nome)}
            apagado={relacao === 'INATIVO'}
            apoio={`${formatarDocumento(c.documento) || 'Sem documento'}${c.contratosAtivos > 0 ? ` · ${c.contratosAtivos} ${c.contratosAtivos === 1 ? 'contrato' : 'contratos'}` : ''}`}
          />,
          <Situacao key="r" cor={COR_DA_RELACAO[relacao]}>{ROTULO_DA_RELACAO[relacao]}</Situacao>,
          <Valor key="f" vazio={!c.faturado12m}>{BRL.format(c.faturado12m)}</Valor>,
          <Valor key="a" vazio={!c.aReceber} tom="alerta">{BRL.format(c.aReceber)}</Valor>,
          <span key="u" className="text-xs tabular text-ink-soft">
            {c.ultimaNota ? new Date(c.ultimaNota).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
          </span>,
        ];
      }}
      detalhe={(c) => {
        const whats = c.telefone?.replace(/\D/g, '');
        return (
          <Detalhe acoes={<BotaoDiscreto href={`/relacionamento/${c.id}`}>Abrir ficha</BotaoDiscreto>}>
            <Campo rotulo="Razão social" largo>{c.nome}</Campo>
            <Campo rotulo={c.tipo === 'PF' ? 'CPF' : 'CNPJ'}>
              <span className="tabular">{formatarDocumento(c.documento) || '—'}</span>
            </Campo>
            <Campo rotulo="A receber">
              <span className="font-serif tabular">{BRL.format(c.aReceber)}</span>
            </Campo>
            <Campo rotulo="Última nota">{c.ultimaNota ? new Date(c.ultimaNota).toLocaleDateString('pt-BR') : 'Nenhuma'}</Campo>
            <Campo rotulo="Relação" largo>
              <MarcaDeRecorrencia cliente={c} />
            </Campo>
            <Campo rotulo="Contato" largo>
              <span className="flex flex-wrap gap-x-5 gap-y-1">
                {c.email ? (
                  <a href={`mailto:${c.email.toLowerCase()}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <Mail className="h-3.5 w-3.5 text-ink-soft" /> {c.email.toLowerCase()}
                  </a>
                ) : null}
                {whats ? (
                  <a href={`https://wa.me/${whats.length <= 11 ? `55${whats}` : whats}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:underline">
                    <MessageCircle className="h-3.5 w-3.5 text-ink-soft" /> {c.telefone}
                  </a>
                ) : null}
                {!c.email && !whats && <span className="text-ink-soft">Sem e-mail nem telefone — complete na ficha.</span>}
              </span>
            </Campo>
          </Detalhe>
        );
      }}
    />
  );
}

/**
 * A relação do cliente e como ela foi definida: pelo sistema (e o porquê) ou
 * à mão. Trocar é um clique: automático, recorrente ou avulso.
 */
export function MarcaDeRecorrencia({ cliente }: { cliente: ClienteDaLista }) {
  const router = useRouter();
  const [salvando, setSalvando] = useState(false);
  const relacao = relacaoDoCliente(cliente);
  const porque =
    relacao === 'INATIVO'
      ? 'Nenhuma nota nos últimos 6 meses'
      : cliente.recorrenciaManual
        ? 'Marcado à mão'
        : cliente.contratosAtivos > 0
          ? 'Tem contrato ativo'
          : `Nota em ${cliente.mesesComNota4} dos últimos 4 meses`;

  async function marcar(m: 'RECORRENTE' | 'AVULSO' | null) {
    setSalvando(true);
    try {
      await marcarRecorrenciaAction(cliente.id, m);
      router.refresh();
    } finally {
      setSalvando(false);
    }
  }

  const opcao = (m: 'RECORRENTE' | 'AVULSO' | null, rotulo: string) => (
    <button
      type="button"
      disabled={salvando}
      onClick={() => marcar(m)}
      className={cliente.recorrenciaManual === m ? 'font-semibold text-ink underline underline-offset-4' : 'text-ink-soft hover:text-ink'}
    >
      {rotulo}
    </button>
  );

  return (
    <span className="flex flex-col gap-2">
      <span className="inline-flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${COR_DA_RELACAO[relacao]}`} />
        <span className="font-medium">{ROTULO_DA_RELACAO[relacao]}</span>
        <span className="text-xs text-ink-soft">
          · {porque} · nota em {cliente.mesesComNota12} dos últimos 12 meses
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="text-ink-soft">Classificar como:</span>
        {opcao(null, 'Automático')}
        {opcao('RECORRENTE', 'Recorrente')}
        {opcao('AVULSO', 'Avulso')}
      </span>
    </span>
  );
}
