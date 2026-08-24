'use client';

import { useState } from 'react';
import { GlassCard } from '@/components/ui/GlassCard';
import { CheckCircle2, ChevronRight, ChevronLeft, FileText, Loader2 } from 'lucide-react';
import type { ContractData } from './StandardContractTemplate';
import { StandardContractTemplate } from './StandardContractTemplate';
import { pdf } from '@react-pdf/renderer';

interface ContractWizardProps {
  onGenerated: (file: File) => void;
  onCancel: () => void;
}

const STEPS = [
  { id: 1, title: 'Contratante' },
  { id: 2, title: 'Contratada' },
  { id: 3, title: 'Serviço' },
  { id: 4, title: 'Revisão' }
];

const fieldClass =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lblClass = 'block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide mb-1.5';

export function ContractWizard({ onGenerated, onCancel }: ContractWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [data, setData] = useState<ContractData>({
    contractor: { name: '', document: '', address: '' },
    contractee: { name: '', document: '', address: '' },
    service: { description: '', value: '', paymentTerms: '', deadline: '' },
    cityDate: ''
  });

  const nextStep = () => setStep(s => Math.min(s + 1, 4));
  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const doc = <StandardContractTemplate data={data} />;
      const asPdf = pdf();
      asPdf.updateContainer(doc);
      const blob = await asPdf.toBlob();
      
      const fileName = `Contrato_${data.contractor.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
      const file = new File([blob], fileName, { type: 'application/pdf' });
      
      onGenerated(file);
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      alert('Erro ao gerar contrato. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">Gerador de Contrato Padrão</h2>
        <button onClick={onCancel} className="text-xs font-bold text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C]">
          Cancelar
        </button>
      </div>

      {/* Stepper Header */}
      <div className="flex items-center justify-between mb-8 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-black/10 dark:bg-white/10 -z-10 -translate-y-1/2"></div>
        {STEPS.map((s) => {
          const isActive = step >= s.id;
          const isCurrent = step === s.id;
          return (
            <div key={s.id} className="flex flex-col items-center bg-[#F4EFE4] dark:bg-[#1A201C] px-3">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-bold text-xs transition-all ${
                isActive ? 'border-[#1E3328] bg-[#1E3328] text-[#DFFFAE]' : 'border-black/15 bg-white/80 text-[#6E6A61] dark:bg-white/10'
              }`}>
                {isActive && !isCurrent ? <CheckCircle2 className="h-4 w-4" /> : s.id}
              </div>
              <span className={`mt-2 text-xs font-bold ${isActive ? 'text-[#2F4A3C] dark:text-[#DFFFAE]' : 'text-[#6E6A61] dark:text-[#A8A49C]'}`}>
                {s.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Passo 1: Contratante */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-4">Dados do Cliente (Contratante)</h3>
          <div>
            <label className={lblClass}>Nome ou Razão Social</label>
            <input 
              value={data.contractor.name} 
              onChange={e => setData(d => ({ ...d, contractor: { ...d.contractor, name: e.target.value } }))}
              placeholder="Ex: João da Silva / João Silva ME"
              className={fieldClass} 
            />
          </div>
          <div>
            <label className={lblClass}>CPF / CNPJ</label>
            <input 
              value={data.contractor.document} 
              onChange={e => setData(d => ({ ...d, contractor: { ...d.contractor, document: e.target.value } }))}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
              className={fieldClass} 
            />
          </div>
          <div>
            <label className={lblClass}>Endereço Completo</label>
            <input 
              value={data.contractor.address} 
              onChange={e => setData(d => ({ ...d, contractor: { ...d.contractor, address: e.target.value } }))}
              placeholder="Rua Exemplo, 123, Bairro, Cidade - UF"
              className={fieldClass} 
            />
          </div>
        </div>
      )}

      {/* Passo 2: Contratada */}
      {step === 2 && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-4">Seus Dados (Contratada)</h3>
          <div>
            <label className={lblClass}>Sua Razão Social / Nome</label>
            <input 
              value={data.contractee.name} 
              onChange={e => setData(d => ({ ...d, contractee: { ...d.contractee, name: e.target.value } }))}
              placeholder="Ex: Minha Empresa LTDA"
              className={fieldClass} 
            />
          </div>
          <div>
            <label className={lblClass}>Seu CNPJ</label>
            <input 
              value={data.contractee.document} 
              onChange={e => setData(d => ({ ...d, contractee: { ...d.contractee, document: e.target.value } }))}
              placeholder="00.000.000/0000-00"
              className={fieldClass} 
            />
          </div>
          <div>
            <label className={lblClass}>Seu Endereço Completo</label>
            <input 
              value={data.contractee.address} 
              onChange={e => setData(d => ({ ...d, contractee: { ...d.contractee, address: e.target.value } }))}
              placeholder="Sua Rua, Seu Bairro, Cidade - UF"
              className={fieldClass} 
            />
          </div>
        </div>
      )}

      {/* Passo 3: Serviço */}
      {step === 3 && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-4">Detalhes do Serviço</h3>
          <div>
            <label className={lblClass}>Descrição Detalhada do Objeto (O que será feito?)</label>
            <textarea 
              value={data.service.description} 
              onChange={e => setData(d => ({ ...d, service: { ...d.service, description: e.target.value } }))}
              placeholder="Ex: Prestação de serviços de consultoria contábil mensal..."
              rows={3}
              className={`${fieldClass} resize-none`} 
            />
          </div>
          <div>
            <label className={lblClass}>Valor (R$)</label>
            <input 
              value={data.service.value} 
              onChange={e => setData(d => ({ ...d, service: { ...d.service, value: e.target.value } }))}
              placeholder="Ex: R$ 5.000,00 (Cinco mil reais)"
              className={fieldClass} 
            />
          </div>
          <div>
            <label className={lblClass}>Forma e Condições de Pagamento</label>
            <input 
              value={data.service.paymentTerms} 
              onChange={e => setData(d => ({ ...d, service: { ...d.service, paymentTerms: e.target.value } }))}
              placeholder="Ex: Via PIX até o dia 05 de cada mês."
              className={fieldClass} 
            />
          </div>
          <div>
            <label className={lblClass}>Prazo / Vigência</label>
            <input 
              value={data.service.deadline} 
              onChange={e => setData(d => ({ ...d, service: { ...d.service, deadline: e.target.value } }))}
              placeholder="Ex: 12 meses renováveis automaticamente."
              className={fieldClass} 
            />
          </div>
          <div>
            <label className={lblClass}>Local e Data da Assinatura</label>
            <input 
              value={data.cityDate} 
              onChange={e => setData(d => ({ ...d, cityDate: e.target.value }))}
              placeholder="Ex: São Paulo, SP, 15 de Outubro de 2024"
              className={fieldClass} 
            />
          </div>
        </div>
      )}

      {/* Passo 4: Revisão */}
      {step === 4 && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-4">Revisão do Contrato</h3>
          <div className="bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 rounded-2xl p-5 text-sm space-y-3">
            <p><strong>Contratante:</strong> {data.contractor.name || '(vazio)'}</p>
            <p><strong>Contratada:</strong> {data.contractee.name || '(vazio)'}</p>
            <p><strong>Serviço:</strong> {data.service.description || '(vazio)'}</p>
            <p><strong>Valor:</strong> {data.service.value || '(vazio)'}</p>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] italic mt-2">
              Verifique os dados acima. Ao clicar em Gerar PDF, o sistema criará o contrato e o anexará para assinatura via DocuSeal.
            </p>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/5 dark:border-white/10">
        <button 
          onClick={prevStep}
          disabled={step === 1 || loading}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>

        {step < 4 ? (
          <button 
            onClick={nextStep}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-bold text-[#DFFFAE] bg-[#1E3328] hover:bg-[#2F4A3C] transition-all shadow-sm hover:scale-105"
          >
            Avançar <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-[#DFFFAE] bg-[#1E3328] hover:bg-[#2F4A3C] transition-all shadow-sm hover:scale-105"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {loading ? 'Gerando...' : 'Gerar e Anexar PDF'}
          </button>
        )}
      </div>
    </div>
  );
}

