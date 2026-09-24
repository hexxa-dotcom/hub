'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FileUp, Loader2, Plus, X } from 'lucide-react';
import { FiltrosEmTexto } from '@/components/ui/FiltrosEmTexto';
import { VisualizadorDeArquivo } from '@/components/ui/VisualizadorDeArquivo';
import { CATEGORIAS, type Categoria } from '@/lib/documentos-categorias';
import type { Documento, ItemDoEssencial } from '@/lib/server/documentos-da-empresa';
import { createDocumentAction, deleteDocumentAction } from './actions';

/**
 * DOCUMENTOS DA EMPRESA.
 *
 * Em cima, o essencial — cada documento com a situação dele (em dia, vence
 * em breve, vencido, falta) e o que fazer: ver, enviar, ou pedir à
 * contabilidade. Embaixo, todos os documentos, venham da empresa ou do
 * contador, abertos dentro do Hub.
 */

type Filtro = 'TODOS' | 'EMPRESA' | 'CONTADOR' | 'CERTIDOES';
const CERTIDOES: Categoria[] = ['CND_FEDERAL', 'CND_ESTADUAL', 'CND_MUNICIPAL', 'CRF_FGTS', 'CND'];

const br = (iso: string | null) => (iso ? iso.split('-').reverse().join('/') : '');
const campo =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-hexxa-forest dark:border-white/10 dark:bg-white/5 dark:focus:border-hexxa-lime';

const SITUACAO: Record<ItemDoEssencial['situacao'], { cor: string; texto: (i: ItemDoEssencial) => string }> = {
  EM_DIA: { cor: 'text-emerald-700 dark:text-emerald-400', texto: (i) => (i.documento?.validoAte ? `Em dia até ${br(i.documento.validoAte)}` : 'Guardado') },
  VENCE_EM_BREVE: { cor: 'text-amber-700 dark:text-amber-400', texto: (i) => `Vence em ${i.diasParaVencer} ${i.diasParaVencer === 1 ? 'dia' : 'dias'}` },
  VENCIDO: { cor: 'text-rose-600 dark:text-rose-400', texto: (i) => `Venceu em ${br(i.documento!.validoAte)}` },
  FALTA: { cor: 'text-ink-soft', texto: () => 'Falta' },
};

export function ArquivosClient({
  docs,
  essencial,
  extras,
}: {
  docs: Documento[];
  essencial: ItemDoEssencial[];
  extras: { certificado: { nivel: string; mensagem: string; validoAte: string | null }; contratosAtivos: number };
}) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>('TODOS');
  const [novo, setNovo] = useState<Categoria | null>(null);
  const [vendo, setVendo] = useState<Documento | null>(null);
  const [removendo, setRemovendo] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      docs.filter((d) =>
        filtro === 'TODOS' ? true : filtro === 'CERTIDOES' ? CERTIDOES.includes(d.categoria) : d.origem === filtro,
      ),
    [docs, filtro],
  );

  async function remover(d: Documento) {
    if (!confirm(`Remover "${d.nome}"? O arquivo é apagado.`)) return;
    setRemovendo(d.id);
    try {
      await deleteDocumentAction(d.id);
      router.refresh();
    } finally {
      setRemovendo(null);
    }
  }

  const certOk = extras.certificado.nivel === 'OK';
  const certRuim = ['AUSENTE', 'VENCIDO', 'INVALIDO'].includes(extras.certificado.nivel);

  return (
    <div className="space-y-16">
      {/* O essencial */}
      <section className="space-y-4">
        <p className="rotulo text-ink-soft">O essencial</p>
        <ul className="divide-y divide-black/5 overflow-hidden rounded-[28px] border border-white/70 bg-white/75 ring-1 ring-inset ring-white/60 backdrop-blur-xl dark:divide-white/10 dark:border-white/10 dark:bg-[#151916]/75 dark:ring-white/5">
          {essencial.map((i) => (
            <li key={i.categoria} className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{i.nome}</p>
                <p className={`mt-0.5 text-xs font-medium ${SITUACAO[i.situacao].cor}`}>
                  {SITUACAO[i.situacao].texto(i)}
                  {i.situacao === 'FALTA' && <span className="font-normal text-ink-soft"> · {i.comoObter}</span>}
                  {i.documento?.origem === 'CONTADOR' && <span className="font-normal text-ink-soft"> · enviado pela contabilidade</span>}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-xs font-semibold">
                {i.documento?.href && (
                  <button type="button" onClick={() => setVendo(i.documento)} className="text-ink hover:underline underline-offset-4">
                    Ver
                  </button>
                )}
                {i.situacao !== 'EM_DIA' && i.link && (
                  <a href={i.link} target="_blank" rel="noreferrer" className="text-ink-soft hover:text-ink">
                    Emitir na Receita
                  </a>
                )}
                {i.situacao !== 'EM_DIA' && i.servico && (
                  <Link href={`/mais/servicos?pedir=${encodeURIComponent(i.servico)}` as never} className="text-ink-soft hover:text-ink">
                    Pedir à contabilidade
                  </Link>
                )}
                <button type="button" onClick={() => setNovo(i.categoria)} className="text-ink-soft hover:text-ink">
                  {i.documento ? 'Enviar nova' : 'Enviar'}
                </button>
              </div>
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-ink">Certificado digital</p>
              <p className={`mt-0.5 text-xs font-medium ${certOk ? 'text-emerald-700 dark:text-emerald-400' : certRuim ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>
                {extras.certificado.validoAte ? `Válido até ${br(extras.certificado.validoAte)}` : extras.certificado.mensagem}
              </p>
            </div>
            <Link href="/configuracoes/fiscal" className="text-xs font-semibold text-ink-soft hover:text-ink">
              {certRuim ? 'Enviar certificado' : 'Ver'}
            </Link>
          </li>
          <li className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
            <div>
              <p className="text-sm font-semibold text-ink">Contratos assinados</p>
              <p className="mt-0.5 text-xs text-ink-soft">
                {extras.contratosAtivos} {extras.contratosAtivos === 1 ? 'contrato ativo' : 'contratos ativos'}
              </p>
            </div>
            <Link href="/meu-negocio/contratos" className="text-xs font-semibold text-ink-soft hover:text-ink">
              Ver contratos
            </Link>
          </li>
        </ul>
      </section>

      {/* Todos */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <FiltrosEmTexto<Filtro>
            ativo={filtro}
            onChange={setFiltro}
            filtros={[
              { id: 'TODOS', label: 'Todos', count: docs.length },
              { id: 'EMPRESA', label: 'Enviados por você', count: docs.filter((d) => d.origem === 'EMPRESA').length },
              { id: 'CONTADOR', label: 'Da contabilidade', count: docs.filter((d) => d.origem === 'CONTADOR').length },
              { id: 'CERTIDOES', label: 'Certidões', count: docs.filter((d) => CERTIDOES.includes(d.categoria)).length },
            ]}
          />
          <button
            type="button"
            onClick={() => setNovo('OUTRO')}
            className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-5 py-2.5 text-xs font-bold text-hexxa-lime shadow-(--elev-1) dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            <Plus className="h-3.5 w-3.5" /> Enviar documento
          </button>
        </div>

        {lista.length === 0 ? (
          <p className="rounded-[28px] border border-dashed border-black/10 px-6 py-12 text-center text-sm text-ink-soft dark:border-white/10">
            {docs.length === 0 ? 'Nenhum documento guardado ainda. Comece pelo essencial, acima.' : 'Nada neste filtro.'}
          </p>
        ) : (
          <ul className="divide-y divide-black/5 rounded-[28px] border border-black/5 dark:divide-white/10 dark:border-white/10">
            {lista.map((d) => (
              <li key={`${d.origem}-${d.id}`} className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{d.nome}</p>
                  <p className="text-xs text-ink-soft">
                    {CATEGORIAS[d.categoria]}
                    {d.emitidoEm ? ` · ${d.origem === 'CONTADOR' ? 'enviado em' : 'emitido em'} ${br(d.emitidoEm)}` : ''}
                    {d.validoAte ? ` · válido até ${br(d.validoAte)}` : ''}
                    {d.protocolo ? ` · ${d.protocolo}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-xs font-semibold">
                  {d.href && (
                    <button type="button" onClick={() => setVendo(d)} className="text-ink hover:underline underline-offset-4">
                      Ver
                    </button>
                  )}
                  {d.origem === 'EMPRESA' && (
                    <button type="button" onClick={() => remover(d)} disabled={removendo === d.id} className="text-ink-soft hover:text-rose-600 disabled:opacity-50">
                      {removendo === d.id ? 'Removendo…' : 'Remover'}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {vendo?.href && <VisualizadorDeArquivo src={vendo.href} titulo={vendo.nome} onClose={() => setVendo(null)} />}
      {novo && (
        <NovoDocumento
          categoria={novo}
          onClose={() => setNovo(null)}
          onDone={() => {
            setNovo(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function NovoDocumento({ categoria, onClose, onDone }: { categoria: Categoria; onClose: () => void; onDone: () => void }) {
  const [cat, setCat] = useState<Categoria>(categoria);
  const [nome, setNome] = useState(categoria === 'OUTRO' ? '' : CATEGORIAS[categoria]);
  const [emitido, setEmitido] = useState('');
  const [validade, setValidade] = useState('');
  const [arquivo, setArquivo] = useState<{ dataUrl: string; nome: string } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  function ler(f: File | undefined) {
    if (!f) return;
    if (!/^(application\/pdf|image\/(png|jpe?g|webp))$/.test(f.type)) return setErro('Envie um PDF ou uma imagem.');
    if (f.size > 3 * 1024 * 1024) return setErro('O arquivo pode ter até 3 MB.');
    setErro(null);
    const r = new FileReader();
    r.onload = () => setArquivo({ dataUrl: String(r.result), nome: f.name });
    r.readAsDataURL(f);
  }

  async function salvar() {
    if (!arquivo) return setErro('Escolha o arquivo.');
    setSalvando(true);
    setErro(null);
    try {
      const r = await createDocumentAction({ category: cat, name: nome, issuedAt: emitido, expiresAt: validade, arquivo });
      if (!r.ok) return setErro(r.message);
      onDone();
    } catch {
      setErro('Não consegui guardar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-3xl border border-black/5 bg-surface p-6 shadow-(--elev-3) dark:border-white/10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="rotulo text-ink-soft">Enviar documento</p>
            <h2 className="mt-1 text-lg font-light uppercase tracking-[0.05em] text-ink">{CATEGORIAS[cat]}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 space-y-4">
          <input ref={ref} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => ler(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-black/15 px-4 py-6 text-sm font-semibold text-ink hover:border-black/30 dark:border-white/20"
          >
            <FileUp className="h-4 w-4" /> {arquivo ? arquivo.nome : 'Escolher PDF ou imagem'}
          </button>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="rotulo text-ink-soft">Tipo</span>
              <select
                value={cat}
                onChange={(e) => {
                  const c = e.target.value as Categoria;
                  if (!nome || nome === CATEGORIAS[cat]) setNome(c === 'OUTRO' ? '' : CATEGORIAS[c]);
                  setCat(c);
                }}
                className={campo}
              >
                {(Object.keys(CATEGORIAS) as Categoria[])
                  .filter((c) => c !== 'CND')
                  .map((c) => (
                    <option key={c} value={c}>
                      {CATEGORIAS[c]}
                    </option>
                  ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="rotulo text-ink-soft">Nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
            </label>
            <label className="block">
              <span className="rotulo text-ink-soft">Emitido em</span>
              <input type="date" value={emitido} onChange={(e) => setEmitido(e.target.value)} className={campo} />
            </label>
            <label className="block">
              <span className="rotulo text-ink-soft">Válido até (se vence)</span>
              <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={campo} />
            </label>
          </div>
          {erro && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
          <button
            type="button"
            onClick={salvar}
            disabled={salvando}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-3 text-sm font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
          >
            {salvando && <Loader2 className="h-4 w-4 animate-spin" />} Guardar documento
          </button>
        </div>
      </div>
    </div>
  );
}
