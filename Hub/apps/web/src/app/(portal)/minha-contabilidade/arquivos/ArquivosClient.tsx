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
import { ListaEmColunas, Titulo, Situacao, BotaoDiscreto, Campo, Detalhe } from '@/components/ui/ListaEmColunas';

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

const PONTO: Record<ItemDoEssencial['situacao'], string> = {
  EM_DIA: 'bg-emerald-500',
  VENCE_EM_BREVE: 'bg-amber-500',
  VENCIDO: 'bg-rose-500',
  FALTA: 'bg-black/25 dark:bg-white/25',
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
  const [confirmarRemocao, setConfirmarRemocao] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      docs.filter((d) =>
        filtro === 'TODOS' ? true : filtro === 'CERTIDOES' ? CERTIDOES.includes(d.categoria) : d.origem === filtro,
      ),
    [docs, filtro],
  );

  async function remover(d: Documento) {
    setConfirmarRemocao(null);
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

  const link = 'text-ink-soft hover:text-ink';
  const linhasDoEssencial: { id: string; nome: string; apoio?: string; situacao: string; cor: string; acoes: React.ReactNode }[] = [
    ...essencial.map((i) => ({
      id: i.categoria,
      nome: i.nome,
      apoio: i.situacao === 'FALTA' ? i.comoObter : i.documento?.origem === 'CONTADOR' ? 'Enviado pela contabilidade' : undefined,
      situacao: SITUACAO[i.situacao].texto(i),
      cor: PONTO[i.situacao],
      acoes: (
        <>
          {i.documento?.href && (
            <button type="button" onClick={() => setVendo(i.documento)} className="text-ink hover:underline underline-offset-4">Ver</button>
          )}
          {i.situacao !== 'EM_DIA' && i.link && (
            <a href={i.link} target="_blank" rel="noreferrer" className={link}>Emitir na Receita</a>
          )}
          {i.situacao !== 'EM_DIA' && i.servico && (
            <Link href={`/mais/servicos?pedir=${encodeURIComponent(i.servico)}` as never} className={link}>Pedir à contabilidade</Link>
          )}
          <button type="button" onClick={() => setNovo(i.categoria)} className={link}>{i.documento ? 'Enviar nova' : 'Enviar'}</button>
        </>
      ),
    })),
    {
      id: 'certificado',
      nome: 'Certificado digital',
      situacao: extras.certificado.validoAte ? `Válido até ${br(extras.certificado.validoAte)}` : certRuim ? 'Falta' : extras.certificado.mensagem,
      apoio: certRuim && !extras.certificado.validoAte ? extras.certificado.mensagem : undefined,
      cor: certOk ? PONTO.EM_DIA : certRuim ? PONTO.VENCIDO : PONTO.VENCE_EM_BREVE,
      acoes: <Link href="/configuracoes/fiscal" className={link}>{certRuim ? 'Enviar certificado' : 'Ver'}</Link>,
    },
    {
      id: 'contratos',
      nome: 'Contratos assinados',
      situacao: `${extras.contratosAtivos} ${extras.contratosAtivos === 1 ? 'ativo' : 'ativos'}`,
      cor: extras.contratosAtivos ? PONTO.EM_DIA : PONTO.FALTA,
      acoes: <Link href="/meu-negocio/contratos" className={link}>Ver contratos</Link>,
    },
  ];

  return (
    <div className="space-y-16">
      {/* O essencial */}
      <section className="space-y-4">
        <p className="rotulo text-ink-soft">O essencial</p>
        <ListaEmColunas
          colunas={[
            { rotulo: 'Documento', largura: 'minmax(0,1fr)' },
            { rotulo: 'Situação', largura: '10rem', soDesktop: true },
            { rotulo: '', largura: '15rem', alinhar: 'direita' },
          ]}
          itens={linhasDoEssencial}
          chave={(l) => l.id}
          celulas={(l) => [
            <Titulo
              key="t"
              nome={l.nome}
              apoio={
                <>
                  <span className="sm:hidden">{l.situacao}{l.apoio ? ' · ' : ''}</span>
                  {l.apoio}
                </>
              }
            />,
            <Situacao key="s" cor={l.cor}>{l.situacao}</Situacao>,
            <span key="a" className="flex items-center justify-end gap-4 text-xs font-semibold">{l.acoes}</span>,
          ]}
        />
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
          <ListaEmColunas
            colunas={[
              { rotulo: 'Documento', largura: 'minmax(0,1fr)' },
              { rotulo: 'De quem', largura: '7rem', soDesktop: true },
              { rotulo: 'Data', largura: '6rem', alinhar: 'direita', soDesktop: true },
              { rotulo: 'Validade', largura: '6rem', alinhar: 'direita' },
            ]}
            itens={lista}
            chave={(d) => `${d.origem}-${d.id}`}
            celulas={(d) => {
              const vencido = !!d.validoAte && d.validoAte < new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
              return [
                <Titulo key="t" nome={d.nome} apoio={`${CATEGORIAS[d.categoria]}${d.protocolo ? ` · ${d.protocolo}` : ''}`} />,
                <span key="o" className="text-xs text-ink-soft">{d.origem === 'CONTADOR' ? 'Contabilidade' : 'Você'}</span>,
                <span key="d" className="text-xs tabular text-ink-soft">{br(d.emitidoEm) || '—'}</span>,
                <span key="v" className={`text-xs tabular ${vencido ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-ink-soft'}`}>{br(d.validoAte) || '—'}</span>,
              ];
            }}
            detalhe={(d) => (
              <Detalhe
                acoes={
                  <>
                    {d.href && <BotaoDiscreto onClick={() => setVendo(d)}>Ver documento</BotaoDiscreto>}
                    {d.origem === 'EMPRESA' &&
                      (confirmarRemocao === d.id ? (
                        <span className="flex items-center gap-3 px-2 py-1.5 text-xs font-semibold">
                          <span className="font-normal text-ink-soft">Remover? O arquivo é apagado.</span>
                          <button type="button" disabled={removendo === d.id} onClick={() => remover(d)} className="text-rose-600 disabled:opacity-50 dark:text-rose-400">Sim</button>
                          <button type="button" onClick={() => setConfirmarRemocao(null)} className="text-ink-soft hover:text-ink">Não</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmarRemocao(d.id)} className="px-2 py-1.5 text-xs font-semibold text-ink-soft hover:text-rose-600">
                          Remover
                        </button>
                      ))}
                  </>
                }
              >
                <Campo rotulo="Tipo">{CATEGORIAS[d.categoria]}</Campo>
                <Campo rotulo={d.origem === 'CONTADOR' ? 'Enviado em' : 'Emitido em'}>{br(d.emitidoEm) || '—'}</Campo>
                <Campo rotulo="Válido até">{br(d.validoAte) || 'Sem validade'}</Campo>
                <Campo rotulo="De quem">{d.origem === 'CONTADOR' ? 'Enviado pela contabilidade' : 'Enviado por você'}</Campo>
                {d.protocolo && <Campo rotulo="Protocolo">{d.protocolo}</Campo>}
              </Detalhe>
            )}
          />
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
