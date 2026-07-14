'use client';

import { useState } from 'react';
import { Save, Bell, Shield } from 'lucide-react';
import { Section, Toggle, fi, lb } from '@/components/admin/AdminUI';

export default function AdminConfiguracoes() {
  const [saved, setSaved] = useState(false);

  function salvar() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Configurações Gerais</h1>
        <p className="text-sm text-slate-500">Ajustes básicos da plataforma e alertas do sistema</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">

        {/* Dados da contabilidade */}
        <Section icon={<Shield className="h-4 w-4" />} title="Dados da contabilidade">
          <div className="space-y-3">
            <div>
              <label className={lb}>Razão social</label>
              <input defaultValue="Hexxa Contabilidade LTDA" className={`mt-1 ${fi}`} />
            </div>
            <div>
              <label className={lb}>CNPJ</label>
              <input defaultValue="00.000.000/0001-99" className={`mt-1 ${fi}`} />
            </div>
            <div>
              <label className={lb}>E-mail de suporte</label>
              <input defaultValue="suporte@hexxa.com.br" type="email" className={`mt-1 ${fi}`} />
            </div>
            <div>
              <label className={lb}>Telefone / WhatsApp</label>
              <input defaultValue="5547999990000" className={`mt-1 ${fi}`} />
            </div>
          </div>
        </Section>

        {/* Alertas */}
        <Section icon={<Bell className="h-4 w-4" />} title="Alertas" desc="Notificações enviadas ao admin por e-mail">
          <Toggle label="Novo cliente cadastrado" defaultOn />
          <Toggle label="Solicitação aberta urgente" defaultOn />
          <Toggle label="Inadimplência detectada" defaultOn />
          <Toggle label="Certificado digital vencendo" defaultOn />
          <Toggle label="Erro de emissão de NF" defaultOn />
          <Toggle label="Trial expirando (3 dias)" />
          <Toggle label="Webhook Asaas falhou" defaultOn />
        </Section>

      </div>

      <div className="flex justify-end">
        <button onClick={salvar}
          className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-medium text-white transition-colors ${saved ? 'bg-green-500' : 'bg-brand-500 hover:bg-brand-600'}`}>
          <Save className="h-4 w-4" />
          {saved ? 'Salvo!' : 'Salvar configurações gerais'}
        </button>
      </div>
    </div>
  );
}
