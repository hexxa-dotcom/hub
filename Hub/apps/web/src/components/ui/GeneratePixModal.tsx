'use client';

import { useState } from 'react';
import { X, QrCode, CheckCircle2, Copy } from 'lucide-react';
import { generatePixCharge } from '@/app/(portal)/configuracoes/integracoes/asaas/billing';

interface GeneratePixModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue?: number;
  initialCustomerName?: string;
  initialCpfCnpj?: string;
  initialDescription?: string;
}

export function GeneratePixModal({ 
  isOpen, 
  onClose, 
  initialValue = 0, 
  initialCustomerName = '', 
  initialCpfCnpj = '',
  initialDescription = 'Cobrança Avulsa'
}: GeneratePixModalProps) {
  
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerCpfCnpj, setCustomerCpfCnpj] = useState(initialCpfCnpj);
  const [value, setValue] = useState(initialValue);
  const [description, setDescription] = useState(initialDescription);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pixData, setPixData] = useState<{ pixCopyPaste: string; encodedImage: string; invoiceUrl: string } | null>(null);

  if (!isOpen) return null;

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const today = new Date();
      today.setDate(today.getDate() + 3); // Vencimento padrão em 3 dias
      const dueDate = today.toISOString().split('T')[0] as string;

      const res = await generatePixCharge({
        customerName,
        customerCpfCnpj,
        value,
        description,
        dueDate
      });
      setPixData(res);
    } catch (err: any) {
      setError(err.message || 'Erro desconhecido ao gerar cobrança.');
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (pixData) {
      navigator.clipboard.writeText(pixData.pixCopyPaste);
      alert('Código copiado!');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl border border-line overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-line bg-surface-card">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand-100 text-brand-600 p-2 rounded-xl">
              <QrCode className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-ink">Gerar PIX (Asaas)</h2>
          </div>
          <button onClick={onClose} className="p-2 text-ink-soft hover:text-ink hover:bg-black/5 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
              {error}
            </div>
          )}

          {pixData ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-ok/10 text-ok">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-bold text-xl text-ink">PIX Gerado!</h3>
              <p className="text-sm text-ink-soft">
                Mostre o QR Code para o cliente ou envie o link de pagamento.
              </p>
              
              <div className="p-4 bg-white rounded-2xl border border-line shadow-sm">
                <img src={`data:image/png;base64,${pixData.encodedImage}`} alt="QR Code" className="w-48 h-48 mx-auto" />
              </div>

              <button 
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-surface-card border border-line hover:bg-black/5 transition-colors text-ink font-semibold text-sm"
              >
                <Copy className="h-4 w-4" /> Copiar Código Pix Copia e Cola
              </button>

              <a 
                href={pixData.invoiceUrl} 
                target="_blank" 
                rel="noreferrer"
                className="w-full text-center py-3 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 transition-colors shadow-md"
              >
                Abrir Fatura Completa
              </a>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Nome do Cliente</label>
                <input 
                  required
                  type="text" 
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-surface-card border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                  placeholder="Ex: João da Silva"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">CPF ou CNPJ</label>
                <input 
                  required
                  type="text" 
                  value={customerCpfCnpj}
                  onChange={e => setCustomerCpfCnpj(e.target.value)}
                  className="w-full bg-surface-card border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                  placeholder="Apenas números"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Descrição (Na fatura)</label>
                <input 
                  required
                  type="text" 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full bg-surface-card border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                  placeholder="Ex: Consultoria Jurídica"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink mb-1.5">Valor (R$)</label>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  min="5"
                  value={value || ''}
                  onChange={e => setValue(parseFloat(e.target.value))}
                  className="w-full bg-surface-card border border-line rounded-xl px-4 py-2.5 text-sm outline-none focus:border-brand-500"
                  placeholder="0.00"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 transition-all shadow-md active:scale-[0.98]"
                >
                  {loading ? 'Gerando PIX...' : 'Gerar Cobrança'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
