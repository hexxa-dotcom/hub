'use client';

import { useState } from 'react';
import { PaperPlaneRight, CaretDown, Info } from '@phosphor-icons/react';

export type ClienteContato = { id: string; nome: string; status: string; email: string };

type Destinatario = 'todos' | 'ativos' | 'trial' | 'inadimplentes' | 'cliente';

const TEMPLATES = [
  { id: 't1', nome: 'Boas-vindas', assunto: 'Bem-vindo ao Hexx Hub Digital!', corpo: 'Olá,\n\nSeja bem-vindo ao Hexx Hub Digital! Estamos felizes em ter você como cliente.\n\nNeste e-mail você encontra as informações de acesso ao sistema e os primeiros passos para configurar sua conta.\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nEquipe Hexxa' },
  { id: 't2', nome: 'Trial expirando', assunto: 'Seu período de teste encerra em breve', corpo: 'Olá,\n\nSeu período de trial no Hexx Hub Digital está terminando.\n\nPara continuar com acesso completo, escolha um plano.\n\nQualquer dúvida estamos à disposição.\n\nAtenciosamente,\nEquipe Hexxa' },
  { id: 't3', nome: 'Cobrança pendente', assunto: 'Regularize sua assinatura Hexx Hub Digital', corpo: 'Olá,\n\nIdentificamos que há uma cobrança em aberto em sua conta.\n\nPara regularizar e manter o acesso ao sistema, entre em contato conosco.\n\nAtenciosamente,\nEquipe Hexxa' },
  { id: 't4', nome: 'Nova funcionalidade', assunto: 'Novidade no Hexx Hub Digital', corpo: 'Olá,\n\nTemos novidades no Hexx Hub Digital! Acesse o sistema e confira.\n\nAbraços,\nEquipe Hexxa' },
];

const DEST_LABELS: Record<Destinatario, string> = {
  todos: 'Todos os clientes',
  ativos: 'Apenas ativos',
  trial: 'Em trial',
  inadimplentes: 'Inadimplentes',
  cliente: 'Cliente específico',
};

const fi = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

function destinatarios(clientes: ClienteContato[], dest: Destinatario, clienteId: string): ClienteContato[] {
  if (dest === 'todos') return clientes;
  if (dest === 'cliente') return clientes.filter((c) => c.id === clienteId);
  if (dest === 'ativos') return clientes.filter((c) => c.status === 'ACTIVE');
  if (dest === 'trial') return clientes.filter((c) => c.status === 'TRIAL');
  return clientes.filter((c) => c.status === 'PAST_DUE');
}

export function ComunicacoesForm({ clientes }: { clientes: ClienteContato[] }) {
  const [dest, setDest] = useState<Destinatario>('todos');
  const [clienteId, setClienteId] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [templateOpen, setTemplateOpen] = useState(false);

  function aplicarTemplate(t: (typeof TEMPLATES)[0]) {
    setAssunto(t.assunto);
    setCorpo(t.corpo);
    setTemplateOpen(false);
  }

  const alvo = destinatarios(clientes, dest, clienteId);

  function enviar() {
    if (!assunto || !corpo || alvo.length === 0) return;
    const bcc = alvo.map((c) => c.email).join(',');
    const url = `mailto:?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    window.location.href = url;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Comunicações</h1>
        <p className="text-sm text-slate-500">Monta o e-mail com os destinatários reais e abre no seu cliente de e-mail para enviar.</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800 dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-300">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Isto abre o app de e-mail configurado no seu computador com os destinatários já em cópia oculta (BCC).
          O envio em si acontece por lá — a Hexxa ainda não tem um serviço de e-mail próprio para disparo em massa,
          então não há histórico de envios aqui.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 space-y-4">
        <h2 className="font-semibold text-slate-900 dark:text-white">Nova mensagem</h2>

        {/* Templates */}
        <div className="relative">
          <button type="button" onClick={() => setTemplateOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
            Usar template <CaretDown className="h-3.5 w-3.5" />
          </button>
          {templateOpen && (
            <div className="absolute left-0 top-9 z-10 w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => aplicarTemplate(t)}
                  className="flex w-full flex-col px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 last:border-0 dark:border-slate-800 transition-colors">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{t.nome}</p>
                  <p className="text-xs text-slate-400 truncate">{t.assunto}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Destinatário */}
        <div>
          <label className="text-xs font-medium text-slate-500">Destinatários</label>
          <select value={dest} onChange={(e) => setDest(e.target.value as Destinatario)} className={`mt-1 ${fi}`}>
            {(Object.keys(DEST_LABELS) as Destinatario[]).map((d) => (
              <option key={d} value={d}>{DEST_LABELS[d]}</option>
            ))}
          </select>
          {dest === 'cliente' && (
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={`mt-2 ${fi}`}>
              <option value="">Selecionar cliente…</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          )}
          <p className="mt-1 text-xs text-slate-400">
            <span className="text-brand-600 font-semibold dark:text-brand-400">{alvo.length}</span> destinatário{alvo.length !== 1 ? 's' : ''} com e-mail cadastrado
          </p>
        </div>

        {/* Assunto */}
        <div>
          <label className="text-xs font-medium text-slate-500">Assunto</label>
          <input value={assunto} onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex.: Novidade no Hexx Hub Digital" className={`mt-1 ${fi}`} />
        </div>

        {/* Corpo */}
        <div>
          <label className="text-xs font-medium text-slate-500">Mensagem</label>
          <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)}
            rows={8} placeholder="Digite sua mensagem aqui…" className={`mt-1 ${fi} resize-none font-mono text-xs`} />
        </div>

        <button onClick={enviar} disabled={!assunto || !corpo || alvo.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 transition-colors disabled:opacity-50">
          <PaperPlaneRight className="h-4 w-4" /> Abrir no e-mail
        </button>
      </div>
    </div>
  );
}
