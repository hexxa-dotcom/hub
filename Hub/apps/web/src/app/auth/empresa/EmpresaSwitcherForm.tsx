'use client';

import { useTransition } from 'react';
import { Buildings } from '@phosphor-icons/react';
import { setActiveCompanyAction } from '@/lib/server/company-switch';

export function EmpresaSwitcherForm({
  companies,
  next,
}: {
  companies: { id: string; legalName: string }[];
  next: string;
}) {
  const [pending, startTransition] = useTransition();

  function select(companyId: string) {
    startTransition(() => setActiveCompanyAction(companyId, next));
  }

  return (
    <div className="w-full max-w-sm space-y-2.5">
      {companies.map((c) => (
        <button
          key={c.id}
          type="button"
          disabled={pending}
          onClick={() => select(c.id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3.5 text-left text-sm font-medium text-[#FEFDF3] transition-colors hover:border-[#DFFFAE] hover:bg-white/10 disabled:opacity-50"
        >
          <Buildings className="h-5 w-5 shrink-0 text-[#DFFFAE]" />
          {c.legalName}
        </button>
      ))}
    </div>
  );
}
