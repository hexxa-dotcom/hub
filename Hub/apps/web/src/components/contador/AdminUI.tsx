'use client';
import { useState } from 'react';
import { Copy, Eye, EyeClosed } from '@phosphor-icons/react';

export const fi = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
export const lb = 'text-xs font-medium text-slate-500 dark:text-slate-400';

export function Section({
  icon, title, desc, children, fullWidth,
}: {
  icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode; fullWidth?: boolean;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900 ${fullWidth ? 'lg:col-span-2' : ''}`}>
      <div className="mb-4 flex items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600">{icon}</span>
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">{title}</h2>
          {desc && <p className="text-xs text-slate-500">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex cursor-pointer items-center justify-between py-2.5 border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <span className="text-sm text-slate-700 dark:text-slate-300">{label}</span>
      <button type="button" onClick={() => setOn(v => !v)}
        className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </label>
  );
}

export function SecretInput({ label, value, placeholder }: { label: string; value?: string; placeholder?: string }) {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState(value ?? '');
  return (
    <div>
      <label className={lb}>{label}</label>
      <div className="relative mt-1">
        <input
          type={show ? 'text' : 'password'}
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={placeholder}
          className={`${fi} pr-9`}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          {show ? <EyeClosed className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div>
      <label className={lb}>{label}</label>
      <div className="relative mt-1">
        <input readOnly value={value}
          className={`${fi} pr-9 font-mono text-xs text-slate-500 bg-slate-50 cursor-default dark:bg-slate-800/70`} />
        <button type="button" onClick={copy}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-500">
          <Copy className={`h-4 w-4 ${copied ? 'text-green-500' : ''}`} />
        </button>
      </div>
    </div>
  );
}
