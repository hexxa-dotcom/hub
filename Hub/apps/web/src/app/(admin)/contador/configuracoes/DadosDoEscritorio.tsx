'use client';

import { useState } from 'react';
import { Save, Shield, Loader2 } from 'lucide-react';
import { Section, fi, lb } from '@/components/contador/AdminUI';
import type { Escritorio } from '@/lib/server/escritorio';
import { salvarEscritorioAction } from './actions';

/** WhatsApp gravado (5547999990000) mostrado como (47) 99999-0000. */
function formatarWhatsapp(d: string | null) {
  if (!d) return '';
  const n = d.startsWith('55') ? d.slice(2) : d;
  return n.length === 11 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length === 10 ? `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}` : d;
}

export function DadosDoEscritorio({ inicial }: { inicial: Escritorio }) {
  const [nome, setNome] = useState(inicial.nome);
  const [cnpj, setCnpj] = useState(inicial.cnpj ?? '');
  const [email, setEmail] = useState(inicial.email ?? '');
  const [whatsapp, setWhatsapp] = useState(formatarWhatsapp(inicial.whatsapp));
  const [horario, setHorario] = useState(inicial.horario ?? '');
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function salvar() {
    setSalvando(true);
    setMsg(null);
    try {
      const r = await salvarEscritorioAction({ nome, cnpj, email, whatsapp, horario });
      setMsg({ ok: r.ok, texto: r.message });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Section icon={<Shield className="h-4 w-4" />} title="Dados do escritório" desc="O que aparece para os clientes no Atendimento e no botão Falar com Contador">
      <div className="grid gap-3.5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lb}>Nome do escritório</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Hexx Contabilidade" className={`mt-1.5 ${fi}`} />
        </div>
        <div>
          <label className={lb}>CNPJ</label>
          <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} className={`mt-1.5 ${fi}`} />
        </div>
        <div>
          <label className={lb}>E-mail de atendimento</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1.5 ${fi}`} />
        </div>
        <div>
          <label className={lb}>WhatsApp</label>
          <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} inputMode="tel" placeholder="(47) 99999-0000" className={`mt-1.5 ${fi}`} />
        </div>
        <div>
          <label className={lb}>Horário de atendimento</label>
          <input value={horario} onChange={(e) => setHorario(e.target.value)} placeholder="Seg a sex, 8h às 18h" className={`mt-1.5 ${fi}`} />
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-xs font-semibold ${msg ? (msg.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400') : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
          {msg?.texto ?? (whatsapp ? '' : 'Sem WhatsApp, o botão Falar com Contador abre o Atendimento dentro do Hub.')}
        </p>
        <button
          type="button"
          onClick={salvar}
          disabled={salvando}
          className="inline-flex items-center gap-2 rounded-full bg-[#1E3328] px-6 py-3 text-xs font-bold text-[#DFFFAE] shadow-xs hover:bg-[#2F4A3C] disabled:opacity-60"
        >
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar
        </button>
      </div>
    </Section>
  );
}
