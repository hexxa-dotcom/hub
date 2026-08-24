'use client';
import { useState } from 'react';
import { Copy, Eye, EyeOff, Check } from 'lucide-react';

export const fi = 'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-3.5 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none transition-colors focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE]';
export const lb = 'text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider';

export function Section({
  icon, title, desc, children, fullWidth,
}: {
  icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode; fullWidth?: boolean;
}) {
  return (
    <section className={`rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm ${fullWidth ? 'lg:col-span-2' : ''}`}>
      <div className="mb-6 flex items-start gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#EFFFD6] text-[#2F4A3C] dark:bg-[#2F4A3C] dark:text-[#DFFFAE]">{icon}</span>
        <div>
          <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">{title}</h2>
          {desc && <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">{desc}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <label className="flex cursor-pointer items-center justify-between py-3 border-b border-black/5 dark:border-white/10 last:border-b-0">
      <span className="text-sm font-medium text-[#231F20] dark:text-[#FEFDF3]">{label}</span>
      <button type="button" onClick={() => setOn(v => !v)}
        className={`relative h-6 w-11 rounded-full transition-colors ${on ? 'bg-[#1E3328] dark:bg-[#DFFFAE]' : 'bg-black/15 dark:bg-white/15'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white dark:bg-[#1E3328] shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
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
      <div className="relative mt-1.5">
        <input
          type={show ? 'text' : 'password'}
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder={placeholder}
          className={`${fi} pr-10`}
        />
        <button type="button" onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C] dark:hover:text-[#FEFDF3]">
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
      <div className="relative mt-1.5">
        <input readOnly value={value}
          className={`${fi} pr-10 font-mono text-xs text-[#6E6A61] dark:text-[#A8A49C] bg-[#F4EFE4]/40 dark:bg-[#1A201C]/40 cursor-default`} />
        <button type="button" onClick={copy}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6E6A61] hover:text-[#2F4A3C] dark:text-[#A8A49C] dark:hover:text-[#DFFFAE]">
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
