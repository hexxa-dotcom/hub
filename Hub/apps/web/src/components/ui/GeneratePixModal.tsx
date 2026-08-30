'use client';

import { useState } from 'react';
import { X, QrCode, CheckCircle2, Copy, Sparkles, Loader2, ExternalLink } from 'lucide-react';
import { generatePixCharge } from '@/app/(portal)/configuracoes/integracoes/asaas/billing';

interface GeneratePixModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialValue?: number;
  initialCustomerName?: string;
  initialCpfCnpj?: string;
  initialDescription?: string;
  /** Lançamento a baixar automaticamente quando o Pix cair (ver billing.ts). */
  financialEntryId?: string;
}

export function GeneratePixModal({
  isOpen,
  onClose,
  initialValue = 0,
  initialCustomerName = '',
  initialCpfCnpj = '',
  initialDescription = 'Cobrança de Serviços',
  financialEntryId,
}: GeneratePixModalProps) {
  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerCpfCnpj, setCustomerCpfCnpj] = useState(initialCpfCnpj);
  const [value, setValue] = useState(initialValue);
  const [description, setDescription] = useState(initialDescription);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pixData, setPixData] = useState<{ pixCopyPaste: string; encodedImage?: string; qrCodeUrl?: string; invoiceUrl: string } | null>(null);

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
        dueDate,
        financialEntryId,
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
      alert('Código Pix Copia e Cola copiado para a área de transferência!');
    }
  }

  const field =
    'w-full bg-[#FEFDF3] dark:bg-[#1A201C] border border-black/10 dark:border-white/10 rounded-2xl px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
  const lbl = 'block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-1.5';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-up">
      <div className="bg-[#F4EFE4] dark:bg-[#1A201C] w-full max-w-md rounded-3xl shadow-2xl border border-black/10 dark:border-white/10 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-black/5 dark:border-white/10 bg-white/40 dark:bg-black/20">
          <div className="flex items-center gap-2.5">
            <div className="bg-[#1E3328] text-[#DFFFAE] p-2 rounded-2xl shadow-sm">
              <QrCode className="h-5 w-5" />
            </div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-[#231F20] dark:text-[#FEFDF3]">
              Gerar Cobrança Pix
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#6E6A61] hover:text-[#231F20] dark:hover:text-[#FEFDF3] hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 text-xs rounded-2xl border border-red-200 font-bold">
              {error}
            </div>
          )}

          {pixData ? (
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex items-center justify-center h-12 w-12 rounded-full bg-[#EFFFD6] text-[#2F4A3C] border border-[#DFFFAE]">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-xl text-[#231F20] dark:text-[#FEFDF3]">Pix Gerado com Sucesso!</h3>
                <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] mt-1">
                  Apresente o QR Code ou compartilhe o código copia e cola com o cliente.
                </p>
              </div>

              <div className="p-4 bg-white rounded-3xl border border-black/10 shadow-sm">
                <img src={pixData.encodedImage ? `data:image/png;base64,${pixData.encodedImage}` : pixData.qrCodeUrl} alt="QR Code" className="w-48 h-48 mx-auto" />
              </div>

              <button
                type="button"
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-full bg-white dark:bg-white/10 border border-black/10 dark:border-white/10 hover:bg-black/5 transition-colors text-[#231F20] dark:text-[#FEFDF3] font-bold text-xs shadow-sm"
              >
                <Copy className="h-4 w-4" /> Copiar Código Pix Copia e Cola
              </button>

              <a
                href={pixData.invoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-1.5 py-3 rounded-full text-xs font-bold text-[#DFFFAE] bg-[#1E3328] hover:bg-[#2F4A3C] transition-colors shadow-sm"
              >
                <ExternalLink className="h-4 w-4" /> Abrir Fatura Completa
              </a>
            </div>
          ) : (
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className={lbl}>Nome do Cliente *</label>
                <input
                  required
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={field}
                  placeholder="Ex: João da Silva / Empresa X"
                />
              </div>
              <div>
                <label className={lbl}>CPF ou CNPJ *</label>
                <input
                  required
                  type="text"
                  value={customerCpfCnpj}
                  onChange={(e) => setCustomerCpfCnpj(e.target.value)}
                  className={field}
                  placeholder="Apenas números ou formatado"
                />
              </div>
              <div>
                <label className={lbl}>Descrição do Serviço *</label>
                <input
                  required
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={field}
                  placeholder="Ex: Prestação de Consultoria"
                />
              </div>
              <div>
                <label className={lbl}>Valor (R$) *</label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="5"
                  value={value || ''}
                  onChange={(e) => setValue(parseFloat(e.target.value))}
                  className={`${field} font-serif text-base font-bold text-[#1E3328] dark:text-[#DFFFAE]`}
                  placeholder="0,00"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-full text-xs sm:text-sm font-bold text-[#DFFFAE] bg-[#1E3328] hover:bg-[#2F4A3C] disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {loading ? 'Gerando Cobrança Pix...' : 'Gerar Cobrança Instantânea'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
