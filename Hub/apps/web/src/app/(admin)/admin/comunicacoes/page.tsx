'use client';

import { useState } from 'react';
import { Send, Users, User, CheckCircle2, Clock, ChevronDown } from 'lucide-react';

type Destinatario = 'todos' | 'ativos' | 'trial' | 'inadimplentes' | 'cliente';

type Mensagem = {
  id: string;
  para: string;
  assunto: string;
  corpo: string;
  enviadaEm: string;
  status: 'enviada' | 'agendada';
};

const CLIENTES = [
  { id: '1', nome: 'Hexxa Demo Serviços LTDA', status: 'ativo' },
  { id: '2', nome: 'Tech Soluções ME', status: 'ativo' },
  { id: '3', nome: 'Consultoria Silva & Cia', status: 'ativo' },
  { id: '4', nome: 'Studio Criativo LTDA', status: 'trial' },
  { id: '5', nome: 'Advocacia Mendes Associados', status: 'inadimplente' },
  { id: '6', nome: 'DEF Comércio e Serviços ME', status: 'ativo' },
];

const TEMPLATES = [
  { id: 't1', nome: 'Boas-vindas', assunto: 'Bem-vindo ao Hexx Hub Digital!', corpo: 'Olá {nome},\n\nSeja bem-vindo ao Hexx Hub Digital! Estamos felizes em ter você como cliente.\n\nNeste e-mail você encontra as informações de acesso ao sistema e os primeiros passos para configurar sua conta.\n\nQualquer dúvida, estamos à disposição.\n\nAtenciosamente,\nEquipe Hexxa' },
  { id: 't2', nome: 'Trial expirando', assunto: 'Seu período de teste encerra em 3 dias', corpo: 'Olá {nome},\n\nSeu período de trial no Hexx Hub Digital encerra em 3 dias.\n\nPara continuar com acesso completo, escolha um plano em: [link]\n\nQualquer dúvida estamos à disposição.\n\nAtenciosamente,\nEquipe Hexxa' },
  { id: 't3', nome: 'Cobrança pendente', assunto: 'Regularize sua assinatura Hexx Hub Digital', corpo: 'Olá {nome},\n\nIdentificamos que há uma cobrança em aberto em sua conta.\n\nPara regularizar e manter o acesso ao sistema, acesse: [link de pagamento]\n\nEm caso de dúvidas, entre em contato conosco.\n\nAtenciosamente,\nEquipe Hexxa' },
  { id: 't4', nome: 'Nova funcionalidade', assunto: 'Novidade no Hexx Hub Digital: {feature}', corpo: 'Olá {nome},\n\nTemos novidades! Acabamos de lançar [feature] no Hexx Hub Digital.\n\nAcesse agora e confira:\n[descrição da feature]\n\nAbraços,\nEquipe Hexxa' },
];

const HISTORICO: Mensagem[] = [
  { id: 'h1', para: 'Todos os clientes (6)', assunto: 'Bem-vindo ao Hexx Hub Digital!', corpo: '', enviadaEm: '2026-06-01 09:00', status: 'enviada' },
  { id: 'h2', para: 'Clients em trial (1)', assunto: 'Seu período de teste encerra em 3 dias', corpo: '', enviadaEm: '2026-06-25 08:00', status: 'enviada' },
  { id: 'h3', para: 'Advocacia Mendes Associados', assunto: 'Regularize sua assinatura Hexx Hub Digital', corpo: '', enviadaEm: '2026-06-27 10:30', status: 'enviada' },
];

const fi = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

const DEST_LABELS: Record<Destinatario, string> = {
  todos: 'Todos os clientes',
  ativos: 'Apenas ativos',
  trial: 'Em trial',
  inadimplentes: 'Inadimplentes',
  cliente: 'Cliente específico',
};

function contarDest(dest: Destinatario, clienteId: string) {
  if (dest === 'todos') return CLIENTES.length;
  if (dest === 'cliente') return clienteId ? 1 : 0;
  return CLIENTES.filter(c => c.status === dest || (dest === 'inadimplentes' && c.status === 'inadimplente')).length;
}

export default function AdminComunicacoes() {
  const [dest, setDest] = useState<Destinatario>('todos');
  const [clienteId, setClienteId] = useState('');
  const [assunto, setAssunto] = useState('');
  const [corpo, setCorpo] = useState('');
  const [enviadas, setEnviadas] = useState(HISTORICO);
  const [sent, setSent] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);

  function aplicarTemplate(t: typeof TEMPLATES[0]) {
    setAssunto(t.assunto);
    setCorpo(t.corpo);
    setTemplateOpen(false);
  }

  function enviar() {
    if (!assunto || !corpo) return;
    const para = dest === 'cliente'
      ? CLIENTES.find(c => c.id === clienteId)?.nome ?? 'Cliente'
      : DEST_LABELS[dest];
    setEnviadas(prev => [{
      id: Date.now().toString(), para, assunto, corpo,
      enviadaEm: new Date().toLocaleString('pt-BR'), status: 'enviada',
    }, ...prev]);
    setSent(true);
    setTimeout(() => { setSent(false); setAssunto(''); setCorpo(''); }, 2000);
  }

  const qtdDest = contarDest(dest, clienteId);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Comunicações</h1>
        <p className="text-sm text-slate-500">Envie avisos e e-mails para seus clientes</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Compose */}
        <div className="lg:col-span-3 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-white">Nova mensagem</h2>

          {/* Templates */}
          <div className="relative">
            <button type="button" onClick={() => setTemplateOpen(o => !o)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
              Usar template <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {templateOpen && (
              <div className="absolute left-0 top-9 z-10 w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                {TEMPLATES.map(t => (
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
            <select value={dest} onChange={e => setDest(e.target.value as Destinatario)} className={`mt-1 ${fi}`}>
              {(Object.keys(DEST_LABELS) as Destinatario[]).map(d => (
                <option key={d} value={d}>{DEST_LABELS[d]}</option>
              ))}
            </select>
            {dest === 'cliente' && (
              <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={`mt-2 ${fi}`}>
                <option value="">Selecionar cliente…</option>
                {CLIENTES.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            )}
            {qtdDest > 0 && (
              <p className="mt-1 text-xs text-slate-400">
                <span className="text-brand-600 font-semibold dark:text-brand-400">{qtdDest}</span> destinatário{qtdDest !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Assunto */}
          <div>
            <label className="text-xs font-medium text-slate-500">Assunto</label>
            <input value={assunto} onChange={e => setAssunto(e.target.value)}
              placeholder="Ex.: Novidade no Hexx Hub Digital" className={`mt-1 ${fi}`} />
          </div>

          {/* Corpo */}
          <div>
            <label className="text-xs font-medium text-slate-500">Mensagem</label>
            <textarea value={corpo} onChange={e => setCorpo(e.target.value)}
              rows={8} placeholder="Digite sua mensagem aqui…&#10;Use {nome} para inserir o nome do cliente." className={`mt-1 ${fi} resize-none font-mono text-xs`} />
          </div>

          <button onClick={enviar} disabled={!assunto || !corpo || sent}
            className={`w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-50 ${sent ? 'bg-green-500' : 'bg-brand-500 hover:bg-brand-600'}`}>
            {sent ? <><CheckCircle2 className="h-4 w-4" /> Enviado!</> : <><Send className="h-4 w-4" /> Enviar mensagem</>}
          </button>
        </div>

        {/* Histórico */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Histórico</h2>
          <div className="space-y-3">
            {enviadas.map(m => (
              <div key={m.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{m.assunto}</p>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <Users className="h-3 w-3 shrink-0" />
                      {m.para}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 shrink-0" />
                      {m.enviadaEm}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Enviada
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
