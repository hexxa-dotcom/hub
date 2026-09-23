'use client';

import { useActionState, useMemo, useState } from 'react';
import { Send, Eye, EyeOff, CheckCircle2, ChevronDown, ChevronUp, Mail, FileText, Loader2 } from 'lucide-react';
import type { Entrega, EventoDeEntrega } from '@/lib/server/entregas';
import { enviarDocumentoAction, historicoAction, reenviarAvisoAction, type EstadoDoEnvio } from './actions';

const campo =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-[#231F20] dark:border-white/10 dark:bg-white/5 dark:text-[#F5F6F4]';
const rotulo = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C]';

const NOMES_DOS_EVENTOS: Record<string, string> = {
  ENVIADO: 'Enviado',
  EMAIL_ENVIADO: 'Aviso por e-mail enviado',
  EMAIL_NAO_ENVIADO: 'Aviso por e-mail não enviado',
  VISUALIZADO: 'Aberto pelo cliente',
  BAIXADO: 'Baixado pelo cliente',
  CONFIRMADO: 'Cliente confirmou o recebimento',
  ABERTO_PELO_CONTADOR: 'Aberto pelo contador (não conta como leitura)',
};

const dataHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

type Filtro = 'todos' | 'nao-aberto' | 'aberto' | 'confirmado';

/** Em que pé está a entrega, do ponto de vista de quem precisa provar que entregou. */
function situacao(e: Entrega) {
  if (e.confirmadoEm) return { texto: 'Confirmado', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400', icone: CheckCircle2 };
  if (e.visualizadoEm) return { texto: 'Aberto', cls: 'bg-sky-500/10 text-sky-700 dark:text-sky-400', icone: Eye };
  return { texto: 'Não aberto', cls: 'bg-amber-500/10 text-amber-700 dark:text-amber-400', icone: EyeOff };
}

export function DocumentosDoEscritorio({
  empresas,
  entregas,
  tipos,
  clienteInicial,
}: {
  empresas: { id: string; nome: string }[];
  entregas: Entrega[];
  tipos: Record<string, string>;
  clienteInicial: string;
}) {
  const [estado, enviar, enviando] = useActionState<EstadoDoEnvio, FormData>(enviarDocumentoAction, { ok: true, message: '' });
  const [cliente, setCliente] = useState(clienteInicial);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [aberto, setAberto] = useState<string | null>(null);
  const [historico, setHistorico] = useState<Record<string, EventoDeEntrega[]>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      entregas.filter(
        (e) =>
          (!cliente || e.companyId === cliente) &&
          (filtro === 'todos' ||
            (filtro === 'nao-aberto' && !e.visualizadoEm) ||
            (filtro === 'aberto' && e.visualizadoEm && !e.confirmadoEm) ||
            (filtro === 'confirmado' && e.confirmadoEm)),
      ),
    [entregas, cliente, filtro],
  );

  async function alternar(id: string) {
    if (aberto === id) return setAberto(null);
    setAberto(id);
    if (!historico[id]) {
      const h = await historicoAction(id);
      setHistorico((atual) => ({ ...atual, [id]: h }));
    }
  }

  return (
    <div className="space-y-6">
      <form action={enviar} className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <h2 className="flex items-center gap-2 font-serif text-lg font-bold text-[#231F20] dark:text-[#F5F6F4]">
          <Send className="h-4 w-4" /> Enviar documento
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={rotulo}>Cliente</span>
            <select name="companyId" required value={cliente} onChange={(e) => setCliente(e.target.value)} className={campo}>
              <option value="">Escolha…</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={rotulo}>Tipo</span>
            <select name="tipo" required defaultValue="GUIA" className={campo}>
              {Object.entries(tipos).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className={rotulo}>Título — o que o cliente vai ler</span>
            <input name="titulo" required placeholder="Ex.: Guia de ISS de agosto, CND Federal, DEFIS 2026" className={campo} />
          </label>
          <label className="block sm:col-span-2">
            <span className={rotulo}>Observação para o cliente (opcional)</span>
            <textarea name="descricao" rows={2} className={campo} />
          </label>
          <label className="block sm:col-span-2">
            <span className={rotulo}>Arquivo (PDF ou imagem, até 4 MB)</span>
            <input name="arquivo" type="file" accept=".pdf,image/*,.xml,.zip" className="mt-1 block text-sm" />
          </label>
          <label className="block">
            <span className={rotulo}>Valor a pagar (opcional)</span>
            <input name="valor" inputMode="decimal" placeholder="0,00" className={campo} />
          </label>
          <label className="block">
            <span className={rotulo}>Vencimento (opcional)</span>
            <input name="vencimento" type="date" className={campo} />
          </label>
        </div>
        <p className="mt-2 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Com valor e vencimento, o documento também entra na lista de guias a pagar do cliente.
        </p>
        <label className="mt-4 flex items-center gap-2 text-sm text-[#231F20] dark:text-[#F5F6F4]">
          <input type="checkbox" name="avisar" defaultChecked /> Avisar o cliente por e-mail
        </label>
        {estado.message && (
          <p className={`mt-3 text-sm font-bold ${estado.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
            {estado.message}
          </p>
        )}
        <button
          type="submit"
          disabled={enviando}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#1E3328] px-5 py-2.5 text-sm font-bold text-[#DFFFAE] disabled:opacity-50"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar com protocolo
        </button>
      </form>

      <section className="rounded-3xl border border-black/5 bg-white/80 p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-lg font-bold text-[#231F20] dark:text-[#F5F6F4]">Entregas</h2>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['todos', 'Todas'],
                ['nao-aberto', 'Não abertas'],
                ['aberto', 'Abertas'],
                ['confirmado', 'Confirmadas'],
              ] as [Filtro, string][]
            ).map(([k, v]) => (
              <button
                key={k}
                type="button"
                onClick={() => setFiltro(k)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${
                  filtro === k ? 'bg-[#1E3328] text-[#DFFFAE]' : 'border border-black/10 text-[#6E6A61] dark:border-white/10'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {cliente && (
          <p className="mt-2 text-xs text-[#6E6A61]">
            Mostrando só {empresas.find((e) => e.id === cliente)?.nome}.{' '}
            <button type="button" className="font-bold underline" onClick={() => setCliente('')}>Ver todos</button>
          </p>
        )}
        {aviso && <p className="mt-2 text-xs font-bold text-[#231F20] dark:text-[#F5F6F4]">{aviso}</p>}

        <ul className="mt-4 divide-y divide-black/5 dark:divide-white/5">
          {lista.length === 0 && <li className="py-6 text-center text-sm text-[#6E6A61]">Nenhuma entrega aqui.</li>}
          {lista.map((e) => {
            const s = situacao(e);
            return (
              <li key={e.id} className="py-3">
                <button type="button" onClick={() => alternar(e.id)} className="flex w-full items-center gap-3 text-left">
                  <FileText className="h-4 w-4 shrink-0 text-[#6E6A61]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
                      {e.titulo}
                      {e.valor != null && <span className="font-normal text-[#6E6A61]"> · {BRL.format(e.valor)}</span>}
                    </p>
                    <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
                      {e.protocolo} · {e.empresa} · {e.origem === 'ONEFLOW' ? 'OneFlow' : tipos[e.tipo]} · enviado {dataHora(e.enviadoEm)}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.cls}`}>
                    <s.icone className="h-3 w-3" /> {s.texto}
                  </span>
                  {aberto === e.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                {aberto === e.id && (
                  <div className="ml-7 mt-3 space-y-2">
                    {!historico[e.id] ? (
                      <p className="text-xs text-[#6E6A61]">Carregando histórico…</p>
                    ) : (
                      <ol className="space-y-1.5 border-l border-black/10 pl-4 dark:border-white/10">
                        {historico[e.id]!.map((h, i) => (
                          <li key={i} className="text-xs">
                            <span className="font-bold text-[#231F20] dark:text-[#F5F6F4]">{NOMES_DOS_EVENTOS[h.tipo] ?? h.tipo}</span>
                            <span className="text-[#6E6A61]"> — {dataHora(h.em)}</span>
                            {h.detalhe && h.tipo.startsWith('EMAIL') && <span className="block text-[#6E6A61]">{h.detalhe}</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                    <button
                      type="button"
                      onClick={async () => setAviso(await reenviarAvisoAction(e.id))}
                      className="inline-flex items-center gap-1 rounded-full border border-black/10 px-3 py-1 text-xs font-bold dark:border-white/10"
                    >
                      <Mail className="h-3 w-3" /> Reenviar aviso por e-mail
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
