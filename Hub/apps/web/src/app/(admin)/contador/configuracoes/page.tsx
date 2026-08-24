'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { Save, Bell, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { Section, Toggle, fi, lb } from '@/components/contador/AdminUI';

export default function AdminConfiguracoes() {
  const [saved, setSaved] = useState(false);

  function salvar() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Configurações Gerais</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Ajustes básicos da plataforma e alertas do sistema</p>
      </div>

      <Link
        href={'/contador/configuracoes/ia-insights' as Route}
        className="block rounded-3xl border border-black/5 dark:border-white/10 bg-[#1E3328] p-6 shadow-sm relative overflow-hidden group hover:scale-[1.005] transition-transform"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DFFFAE]/15 text-[#DFFFAE]">
            <Sparkles className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-serif font-bold text-base text-[#FEFDF3]">Hexxa Insights</h3>
            <p className="text-xs text-[#DFFFAE]/70 mt-0.5">
              Dicas contextuais por IA nas telas dos clientes — chave da API, liga/desliga geral e por seção.
            </p>
          </div>
          <ArrowRight className="h-5 w-5 text-[#DFFFAE] shrink-0 transition-transform group-hover:translate-x-1" />
        </div>
      </Link>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Dados da contabilidade */}
        <Section icon={<Shield className="h-4 w-4" />} title="Dados da contabilidade">
          <div className="space-y-3.5">
            <div>
              <label className={lb}>Razão social</label>
              <input defaultValue="Hexxa Contabilidade LTDA" className={`mt-1.5 ${fi}`} />
            </div>
            <div>
              <label className={lb}>CNPJ</label>
              <input defaultValue="00.000.000/0001-99" className={`mt-1.5 ${fi}`} />
            </div>
            <div>
              <label className={lb}>E-mail de suporte</label>
              <input defaultValue="suporte@hexxa.com.br" type="email" className={`mt-1.5 ${fi}`} />
            </div>
            <div>
              <label className={lb}>Telefone / WhatsApp</label>
              <input defaultValue="5547999990000" className={`mt-1.5 ${fi}`} />
            </div>
          </div>
        </Section>

        {/* Alertas */}
        <Section icon={<Bell className="h-4 w-4" />} title="Alertas" desc="Notificações enviadas ao admin por e-mail">
          <div className="space-y-1">
            <Toggle label="Novo cliente cadastrado" defaultOn />
            <Toggle label="Solicitação aberta urgente" defaultOn />
            <Toggle label="Inadimplência detectada" defaultOn />
            <Toggle label="Certificado digital vencendo" defaultOn />
            <Toggle label="Erro de emissão de NF" defaultOn />
            <Toggle label="Trial expirando (3 dias)" />
            <Toggle label="Webhook Asaas falhou" defaultOn />
          </div>
        </Section>
      </div>

      <div className="flex justify-end pt-2">
        <button onClick={salvar}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-xs font-bold text-white transition-all shadow-xs ${saved ? 'bg-emerald-600' : 'bg-[#1E3328] hover:bg-[#2F4A3C] text-[#DFFFAE]'}`}>
          <Save className="h-4 w-4" />
          {saved ? 'Salvo!' : 'Salvar configurações gerais'}
        </button>
      </div>
    </div>
  );
}

