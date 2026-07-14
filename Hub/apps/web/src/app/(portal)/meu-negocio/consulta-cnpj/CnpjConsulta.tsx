'use client';

import { useState, useRef } from 'react';
import {
  Search,
  Loader2,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

type CnpjResult = {
  taxId: string;
  company: { name: string; equity: number };
  alias: string | null;
  founded: string | null;
  head: boolean;
  status: { id: number; text: string };
  address: {
    street: string; number: string; details: string | null;
    district: string; city: string; state: string; zip: string;
    country?: { name: string };
  };
  phones: { area: string; number: string }[];
  emails: { address: string }[];
  mainActivity: { id: string; text: string } | null;
  simples?: { optant: boolean; since: string | null };
  sintegra?: { registrations: { state: string; number: string; enabled: boolean }[] };
};

function formatCnpj(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      className="ml-1.5 rounded p-0.5 text-ink-soft transition-colors hover:text-ink"
      title="Copiar"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line py-2.5 last:border-0">
      <span className="min-w-[140px] text-xs text-ink-soft">{label}</span>
      <span className="flex items-center text-right text-sm font-medium">
        {value}
        <CopyBtn text={value} />
      </span>
    </div>
  );
}

function Badge({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${ok ? 'bg-ok/10 text-ok' : 'bg-critical/10 text-critical'}`}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
      {text}
    </span>
  );
}

export function CnpjConsulta() {
  const [cnpj, setCnpj] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CnpjResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleCnpjChange(e: React.ChangeEvent<HTMLInputElement>) {
    const formatted = formatCnpj(e.target.value);
    setCnpj(formatted);
  }

  async function handleSearch() {
    const digits = cnpj.replace(/\D/g, '');
    if (digits.length !== 14) { setError('Informe um CNPJ com 14 dígitos.'); return; }
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`/api/cnpj/${digits}?full=true`);
      if (!res.ok) { setError('CNPJ não encontrado na Receita Federal.'); return; }
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setResult(data);
    } catch {
      setError('Falha na consulta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleSearch();
  }

  const addr = result
    ? [result.address.street, result.address.number, result.address.details, result.address.district, result.address.city, result.address.state]
        .filter(Boolean).join(', ')
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Search */}
      <form onSubmit={handleFormSubmit} className="card-flat rounded-card p-5">
        <label className="text-xs font-medium text-ink-soft">CNPJ</label>
        <div className="mt-1.5 flex gap-2">
          <input
            ref={inputRef}
            value={cnpj}
            onChange={handleCnpjChange}
            placeholder="00.000.000/0001-00"
            maxLength={18}
            className="flex-1 rounded-xl border border-line bg-surface-card px-4 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 transition-colors"
          />
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? 'Consultando…' : 'Consultar'}
          </button>
        </div>
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-critical">
            <AlertCircle className="h-4 w-4" /> {error}
          </p>
        )}
      </form>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Header card */}
          <div className="card-flat rounded-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-brand-500" />
                  <h2 className="text-xl font-semibold">{result.company?.name}</h2>
                </div>
                {result.alias && <p className="mt-0.5 text-sm text-ink-soft">{result.alias}</p>}
                <p className="mt-1 font-mono text-sm text-ink-soft">{formatCnpj(result.taxId)}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge ok={result.status?.text === 'ATIVA'} text={result.status?.text ?? '—'} />
                {result.simples?.optant && <Badge ok text="Simples Nacional" />}
                {result.head && <Badge ok text="Matriz" />}
              </div>
            </div>
          </div>

          {/* Dados principais */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Identificação */}
            <section className="card-flat rounded-card p-5">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Building2 className="h-4 w-4 text-brand-500" /> Identificação
              </h3>
              <div className="mt-3">
                <Row label="Razão Social" value={result.company?.name} />
                <Row label="Nome Fantasia" value={result.alias} />
                <Row label="CNPJ" value={formatCnpj(result.taxId)} />
                <Row label="Porte" value={(result as any).company?.size?.text} />
                <Row label="Natureza Jurídica" value={(result as any).company?.nature?.text} />
                <Row label="Capital Social" value={result.company?.equity != null ? `R$ ${result.company.equity.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : null} />
                <Row label="Abertura" value={result.founded ?? null} />
                {result.simples && (
                  <Row label="Simples Nacional" value={result.simples.optant ? `Optante desde ${result.simples.since ?? '?'}` : 'Não optante'} />
                )}
              </div>
            </section>

            {/* Contato & Atividade */}
            <section className="card-flat rounded-card p-5">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <Mail className="h-4 w-4 text-brand-500" /> Contato
              </h3>
              <div className="mt-3">
                {result.emails?.map((em, i) => (
                  <Row key={i} label="E-mail" value={em.address} />
                ))}
                {result.phones?.map((ph, i) => (
                  <Row key={i} label="Telefone" value={`(${ph.area}) ${ph.number}`} />
                ))}
                {result.emails?.length === 0 && result.phones?.length === 0 && (
                  <p className="text-sm text-ink-soft">Sem contatos cadastrados na RF</p>
                )}
              </div>

              <h3 className="mb-1 mt-5 flex items-center gap-2 text-sm font-semibold">
                <Calendar className="h-4 w-4 text-brand-500" /> Atividade
              </h3>
              <div className="mt-3">
                <Row label="CNAE Principal" value={result.mainActivity ? `${result.mainActivity.id} — ${result.mainActivity.text}` : null} />
              </div>
            </section>

            {/* Endereço */}
            <section className="card-flat rounded-card p-5 md:col-span-2">
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-brand-500" /> Endereço
              </h3>
              <div className="mt-3">
                <Row label="Logradouro" value={addr} />
                <Row label="CEP" value={result.address?.zip ? String(result.address.zip).replace(/(\d{5})(\d{3})/, '$1-$2') : null} />
                <Row label="Cidade / UF" value={result.address ? `${result.address.city} / ${result.address.state}` : null} />
                <Row label="País" value={result.address?.country?.name} />
              </div>
            </section>

            {/* IE por estado (sintegra) */}
            {(result as any).sintegra?.registrations?.length > 0 && (
              <section className="card-flat rounded-card p-5 md:col-span-2">
                <h3 className="mb-3 text-sm font-semibold">Inscrições Estaduais</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-ink-soft">
                        <th className="pb-2 pr-4">UF</th>
                        <th className="pb-2 pr-4">Número</th>
                        <th className="pb-2">Situação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(result as any).sintegra.registrations.map((r: any, i: number) => (
                        <tr key={i} className="border-t border-line">
                          <td className="py-2 pr-4 font-medium">{r.state}</td>
                          <td className="py-2 pr-4 font-mono">{r.number}</td>
                          <td className="py-2">
                            <Badge ok={r.enabled} text={r.enabled ? 'Habilitada' : 'Desabilitada'} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
