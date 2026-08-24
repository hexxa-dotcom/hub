'use client';

import { useState } from 'react';
import { Send, ChevronDown, Info } from 'lucide-react';

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

const fi = 'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-3.5 py-2.5 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none transition-colors focus:border-[#2F4A3C]';

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
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Comunicações</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Monta o e-mail com os destinatários reais e abre no seu cliente de e-mail para enviar.</p>
      </div>

      <div className="flex items-start gap-3 rounded-3xl border border-[#2F4A3C]/20 bg-[#EFFFD6] dark:bg-[#2F4A3C]/30 p-4 text-xs text-[#2F4A3C] dark:text-[#DFFFAE]">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <p>
          Isto abre o app de e-mail configurado no seu computador com os destinatários já em cópia oculta (BCC).
          O envio em si acontece por lá — a Hexxa ainda não tem um serviço de e-mail próprio para disparo em massa,
          então não há histórico de envios aqui.
        </p>
      </div>

      <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm space-y-4">
        <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Nova mensagem</h2>

        {/* Templates */}
        <div className="relative">
          <button type="button" onClick={() => setTemplateOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-2 text-xs font-bold text-[#6E6A61] hover:bg-black/5 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors">
            Usar template <ChevronDown className="h-3.5 w-3.5" />
          </button>
          {templateOpen && (
            <div className="absolute left-0 top-11 z-10 w-72 rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
              {TEMPLATES.map((t) => (
                <button key={t.id} type="button" onClick={() => aplicarTemplate(t)}
                  className="flex w-full flex-col px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/5 last:border-0 dark:border-white/10 transition-colors">
                  <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3]">{t.nome}</p>
                  <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] truncate">{t.assunto}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Destinatário */}
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Destinatários</label>
          <select value={dest} onChange={(e) => setDest(e.target.value as Destinatario)} className={`mt-1.5 ${fi}`}>
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
          <p className="mt-1.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            <span className="text-[#2F4A3C] dark:text-[#DFFFAE] font-bold">{alvo.length}</span> destinatário{alvo.length !== 1 ? 's' : ''} com e-mail cadastrado
          </p>
        </div>

        {/* Assunto */}
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Assunto</label>
          <input value={assunto} onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex.: Novidade no Hexx Hub Digital" className={`mt-1.5 ${fi}`} />
        </div>

        {/* Corpo */}
        <div>
          <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Mensagem</label>
          <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)}
            rows={8} placeholder="Digite sua mensagem aqui…" className={`mt-1.5 ${fi} resize-none font-mono text-xs`} />
        </div>

        <button onClick={enviar} disabled={!assunto || !corpo || alvo.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-3 text-xs font-bold text-[#DFFFAE] transition-all shadow-xs disabled:opacity-50">
          <Send className="h-4 w-4" /> Abrir no e-mail
        </button>
      </div>
    </div>
  );
}

