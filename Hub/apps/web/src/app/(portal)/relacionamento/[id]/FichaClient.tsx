'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { CardResumo, GradeDeResumo } from '@/components/ui/CardResumo';
import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';
import type { FichaDoCliente } from '@/lib/server/clientes';
import { FormularioDeCliente, formatarDocumento } from '../ClientesClient';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso: string | null) => (iso ? new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('pt-BR') : '—');
const STATUS_PROPOSTA: Record<string, string> = { rascunho: 'Rascunho', enviada: 'Enviada', vista: 'Vista pelo cliente', aprovada: 'Aceita', rejeitada: 'Recusada', expirada: 'Expirada' };
const STATUS_CONTRATO: Record<string, string> = { ATIVO: 'Ativo', AGUARDANDO_ASSINATURA: 'Aguardando assinatura', CANCELADO: 'Encerrado', RECUSADO: 'Recusado', EXPIRADO: 'Expirado' };

function Secao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="rotulo text-ink-soft">{titulo}</p>
        {acao}
      </div>
      {children}
    </section>
  );
}
const lista = 'divide-y divide-black/[0.08] rounded-[28px] border border-black/5 dark:divide-white/[0.12] dark:border-white/10';
const vazio = (t: string) => <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-6 text-sm text-ink-soft dark:border-white/10">{t}</p>;

export function FichaClient({ ficha }: { ficha: FichaDoCliente }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nota, setNota] = useState<{ chave: string; numero: string | null } | null>(null);
  const c = ficha.cliente;
  const umAno = Date.now() - 365 * 86400000;
  const faturado = ficha.notas.filter((n) => !n.cancelada && n.data && Date.parse(n.data) >= umAno).reduce((s, n) => s + n.valor, 0);
  const receber = ficha.aReceber.reduce((s, r) => s + r.valor, 0);
  const atrasado = ficha.aReceber.filter((r) => r.atrasado).reduce((s, r) => s + r.valor, 0);
  const ativos = ficha.contratos.filter((k) => k.status === 'ATIVO');

  return (
    <div className="space-y-12">
      {/* Contato */}
      <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-ink-soft">
        <p>
          {formatarDocumento(c.documento) || 'Sem documento'}
          {c.email ? ` · ${c.email}` : ''}
          {c.telefone ? ` · ${c.telefone}` : ''}
          {c.endereco ? ` · ${c.endereco}` : ''}
        </p>
        <div className="flex items-center gap-4 text-xs font-semibold">
          {c.telefone && (
            <a href={`https://wa.me/55${c.telefone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')}`} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink">
              WhatsApp
            </a>
          )}
          {c.email && (
            <a href={`mailto:${c.email}`} className="text-ink-soft hover:text-ink">
              E-mail
            </a>
          )}
          <button type="button" onClick={() => setEditando(true)} className="text-ink-soft hover:text-ink">
            Editar
          </button>
        </div>
      </div>

      <GradeDeResumo colunas={3}>
        <CardResumo destaque rotulo="Faturado em 12 meses" valor={BRL.format(faturado)} nota={(() => { const n = ficha.notas.filter((x) => !x.cancelada).length; return `${n} ${n === 1 ? 'nota emitida' : 'notas emitidas'} para ele`; })()} />
        <CardResumo
          rotulo="A receber em aberto"
          valor={BRL.format(receber)}
          tom={atrasado > 0 ? 'negativo' : 'padrao'}
          nota={atrasado > 0 ? `${BRL.format(atrasado)} em atraso` : ficha.aReceber.length ? `${ficha.aReceber.length} parcelas` : 'Nada em aberto'}
        />
        <CardResumo rotulo="Contratos ativos" valor={ativos.length} nota={ativos.length ? `${BRL.format(ativos.reduce((s, k) => s + k.valor, 0))} por mês` : 'Nenhum contrato ativo'} href="/meu-negocio/contratos" />
      </GradeDeResumo>

      <div className="grid gap-10 lg:grid-cols-2">
        <Secao titulo="A receber">
          {ficha.aReceber.length === 0 ? (
            vazio('Nada em aberto com este cliente.')
          ) : (
            <ul className={lista}>
              {ficha.aReceber.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-ink">{r.descricao}</p>
                    <p className={`text-xs ${r.atrasado ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-ink-soft'}`}>
                      {r.atrasado ? 'Venceu' : 'Vence'} em {br(r.vencimento)}
                    </p>
                  </div>
                  <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(r.valor)}</p>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao
          titulo="Contratos"
          acao={
            <Link href="/meu-negocio/contratos" className="text-xs font-semibold text-ink-soft hover:text-ink">
              Novo contrato
            </Link>
          }
        >
          {ficha.contratos.length === 0 ? (
            vazio('Nenhum contrato com este cliente.')
          ) : (
            <ul className={lista}>
              {ficha.contratos.map((k) => (
                <li key={k.id}>
                  <Link href={`/meu-negocio/contratos/${k.id}` as Route} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{k.titulo}</p>
                      <p className="text-xs text-ink-soft">
                        {STATUS_CONTRATO[k.status] ?? k.status} · até {br(k.fim)}
                      </p>
                    </div>
                    <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(k.valor)}/mês</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao titulo="Notas emitidas">
          {ficha.notas.length === 0 ? (
            vazio('Nenhuma nota emitida para este cliente.')
          ) : (
            <ul className={lista}>
              {ficha.notas.map((n) => (
                <li key={n.chave}>
                  <button type="button" onClick={() => setNota({ chave: n.chave, numero: n.numero })} className={`flex w-full items-center justify-between gap-4 px-5 py-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${n.cancelada ? 'opacity-50' : ''}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-ink">{n.numero ? `Nota ${n.numero}` : 'Nota'} · {br(n.data)}{n.cancelada ? ' · cancelada' : ''}</p>
                      {n.descricao && <p className="truncate text-xs text-ink-soft">{n.descricao}</p>}
                    </div>
                    <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(n.valor)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        <Secao
          titulo="Propostas"
          acao={
            <Link href={`/meu-negocio/propostas?cliente=${c.id}` as Route} className="text-xs font-semibold text-ink-soft hover:text-ink">
              Nova proposta
            </Link>
          }
        >
          {ficha.propostas.length === 0 ? (
            vazio('Nenhuma proposta para este cliente.')
          ) : (
            <ul className={lista}>
              {ficha.propostas.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{p.titulo}</p>
                    <p className="text-xs text-ink-soft">
                      {p.numero} · {STATUS_PROPOSTA[p.status] ?? p.status}
                    </p>
                  </div>
                  <p className="font-serif text-sm font-bold tabular text-ink">{BRL.format(p.total)}</p>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {ficha.tarefas.length > 0 && (
          <Secao titulo="Tarefas">
            <ul className={lista}>
              {ficha.tarefas.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <p className={`truncate text-sm ${t.status === 'concluida' ? 'text-ink-soft line-through' : 'text-ink'}`}>{t.titulo}</p>
                  <p className="text-xs text-ink-soft">{t.prazo ? br(t.prazo) : ''}</p>
                </li>
              ))}
            </ul>
          </Secao>
        )}
      </div>

      {editando && (
        <FormularioDeCliente
          inicial={{ id: c.id, nome: c.nome, documento: c.documento, email: c.email, telefone: c.telefone, endereco: c.endereco }}
          onClose={() => setEditando(false)}
          onDone={() => {
            setEditando(false);
            router.refresh();
          }}
        />
      )}
      {nota && <VisualizadorDeArquivo src={`/api/nfse/dfe/${nota.chave}`} titulo={`Nota ${nota.numero ?? ''} · ${c.nome}`} onClose={() => setNota(null)} />}
    </div>
  );
}
