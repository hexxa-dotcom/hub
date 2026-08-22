import Link from 'next/link';
import {  Gear, Users, Receipt, Plug, Faders  } from '@phosphor-icons/react/dist/ssr';
import { SettingsNav } from './SettingsNav'; // I'll create a client component for active state

export const metadata = {
  title: 'Configurações | Hexx Hub',
};

export default function ConfiguracoesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Configurações</h1>
        <p className="mt-2 text-sm text-ink-soft">Gerencie os dados da sua empresa, equipe, conexões e preferências do sistema.</p>
      </header>

      <SettingsNav />

      {/* Conteúdo da Aba */}
      <div className="pt-2">
        {children}
      </div>
    </div>
  );
}
