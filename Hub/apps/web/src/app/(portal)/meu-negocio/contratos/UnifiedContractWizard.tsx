'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, ChevronLeft, FileText, Loader2, Briefcase, Home, HandCoins, Upload, Sparkles } from 'lucide-react';
import { CONTRACT_KIND_LABEL, type ContractKind, type CounterpartyData, type DocumentSource, type WizardSubmission } from './wizard-types';
import { criarContratoEAssinarAction, lookupCounterpartyAction, listPropertiesForWizardAction, type PropertyOption } from './unified-actions';

interface UnifiedContractWizardProps {
  companyType: 'SERVICE' | 'HOLDING';
  hasProperties: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
}

const fieldClass =
  'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-4 py-2.5 text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none focus:border-[#2F4A3C] focus:ring-2 focus:ring-[#DFFFAE] transition-all';
const lblClass = 'block text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide mb-1.5';

const emptyParty = (): CounterpartyData => ({ name: '', document: '', address: '', email: '' });

const KIND_CARDS: { kind: ContractKind; icon: typeof Briefcase; needsProperty: boolean }[] = [
  { kind: 'SERVICO', icon: Briefcase, needsProperty: false },
  { kind: 'ALUGUEL', icon: Home, needsProperty: true },
  { kind: 'MUTUO', icon: HandCoins, needsProperty: false },
];

export function UnifiedContractWizard({ companyType, hasProperties, onDone, onCancel }: UnifiedContractWizardProps) {
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<ContractKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contraparte, setContraparte] = useState<CounterpartyData>(emptyParty());
  const [lookupStatus, setLookupStatus] = useState<'idle' | 'checking' | 'found' | 'not-found'>('idle');

  // Serviço
  const [descricao, setDescricao] = useState('');
  const [valorServico, setValorServico] = useState('');
  const [formaPagamentoServico, setFormaPagamentoServico] = useState('');
  const [dueDayServico, setDueDayServico] = useState('10');

  // Mútuo
  const [direcao, setDirecao] = useState<'MUTUO_ATIVO' | 'MUTUO_PASSIVO'>('MUTUO_ATIVO');
  const [valorMutuo, setValorMutuo] = useState('');
  const [jurosAoMes, setJurosAoMes] = useState('1% ao mês (SELIC)');
  const [formaPagamentoMutuo, setFormaPagamentoMutuo] = useState('');
  const [prazoMutuo, setPrazoMutuo] = useState('');

  // Aluguel
  const [properties, setProperties] = useState<PropertyOption[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [indexType, setIndexType] = useState<'IPCA' | 'IGPM'>('IPCA');

  // Comum
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]!);
  const [endDate, setEndDate] = useState(new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0]!);
  const [cityDate, setCityDate] = useState('');

  // Origem do documento
  const [documentSource, setDocumentSource] = useState<DocumentSource>('AUTO');
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [signingDate, setSigningDate] = useState('');

  useEffect(() => {
    if (kind === 'ALUGUEL' && properties.length === 0) {
      listPropertiesForWizardAction().then(setProperties);
    }
  }, [kind, properties.length]);

  const totalSteps = 4;

  async function handleCnpjBlur() {
    const digits = contraparte.document.replace(/\D/g, '');
    if (digits.length !== 14) return;
    setLookupStatus('checking');
    try {
      const result = await lookupCounterpartyAction(contraparte.document);
      if (result.found) {
        setContraparte((c) => ({ ...c, name: c.name || result.legalName, email: result.ownerEmail }));
        setLookupStatus('found');
      } else {
        setLookupStatus('not-found');
      }
    } catch {
      setLookupStatus('not-found');
    }
  }

  function propertyLabel() {
    return properties.find((p) => p.id === propertyId)?.label ?? '';
  }

  async function handleSubmit() {
    if (!kind) return;
    setError(null);

    if (documentSource === 'ALREADY_SIGNED' && !signedFile) {
      setError('Anexe o PDF do contrato já assinado.');
      return;
    }
    if (documentSource === 'ALREADY_SIGNED' && !signingDate) {
      setError('Informe a data de assinatura.');
      return;
    }

    setLoading(true);
    try {
      let signedPdfBase64: string | undefined;
      let signedPdfFilename: string | undefined;
      if (signedFile) {
        const buf = await signedFile.arrayBuffer();
        signedPdfBase64 = Buffer.from(buf).toString('base64');
        signedPdfFilename = signedFile.name;
      }

      const submission: WizardSubmission = {
        documentSource,
        cityDate: cityDate || `${new Date().toLocaleDateString('pt-BR')}`,
        signedPdfBase64,
        signedPdfFilename,
        signingDate: signingDate || undefined,
        formData:
          kind === 'SERVICO'
            ? { kind: 'SERVICO', contraparte, descricao, valor: Number(valorServico.replace(',', '.')), formaPagamento: formaPagamentoServico, dueDay: Number(dueDayServico), startDate, endDate }
            : kind === 'ALUGUEL'
              ? { kind: 'ALUGUEL', propertyId, propertyLabel: propertyLabel(), contraparte, monthlyRent: Number(monthlyRent.replace(',', '.')), indexType, startDate, endDate }
              : { kind: 'MUTUO', contraparte, direcao, valor: Number(valorMutuo.replace(',', '.')), jurosAoMes, formaPagamento: formaPagamentoMutuo, prazo: prazoMutuo, dueDay: 10, startDate, endDate },
      };

      const result = await criarContratoEAssinarAction(submission);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onDone(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar contrato.');
    } finally {
      setLoading(false);
    }
  }

  const canAdvanceFromKind = kind !== null && (kind !== 'ALUGUEL' || hasProperties);

  return (
    <div className="rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <h2 className="font-serif font-bold text-lg text-[#231F20] dark:text-[#FEFDF3]">Novo Contrato — Gerador Automático</h2>
        <button onClick={onCancel} className="text-xs font-bold text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C]">
          Cancelar
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-xs font-bold text-red-800 dark:text-red-300">{error}</div>
      )}

      {/* Passo 1: tipo */}
      {step === 1 && (
        <div className="space-y-4 animate-in fade-in">
          <p className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wide mb-2">Tipo de Contrato</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {KIND_CARDS.map((c) => {
              const disabled = c.needsProperty && !hasProperties;
              return (
                <button
                  key={c.kind}
                  type="button"
                  disabled={disabled}
                  title={disabled ? 'Cadastre um imóvel em Gestão Patrimonial primeiro.' : undefined}
                  onClick={() => setKind(c.kind)}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all ${
                    disabled
                      ? 'opacity-40 cursor-not-allowed border-black/5 dark:border-white/5'
                      : kind === c.kind
                        ? 'border-[#1E3328] bg-[#1E3328] text-[#DFFFAE] shadow-sm'
                        : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 hover:bg-white'
                  }`}
                >
                  <c.icon className="h-6 w-6" />
                  <span className="text-xs font-bold">{CONTRACT_KIND_LABEL[c.kind]}</span>
                  {disabled && <span className="text-[10px] font-normal">Sem imóvel cadastrado</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Passo 2: dados */}
      {step === 2 && kind && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-2">
            {kind === 'ALUGUEL' ? 'Locatário e Imóvel' : 'Contraparte'}
          </h3>

          {kind === 'ALUGUEL' && (
            <div>
              <label className={lblClass}>Imóvel</label>
              <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)} className={fieldClass}>
                <option value="">Selecione...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
          )}

          {kind === 'MUTUO' && (
            <div>
              <label className={lblClass}>Direção do Mútuo</label>
              <select value={direcao} onChange={(e) => setDirecao(e.target.value as any)} className={fieldClass}>
                <option value="MUTUO_ATIVO">A empresa empresta ao sócio/terceiro (Mútuo Ativo)</option>
                <option value="MUTUO_PASSIVO">O sócio/terceiro empresta à empresa (Mútuo Passivo)</option>
              </select>
            </div>
          )}

          <div>
            <label className={lblClass}>{kind === 'ALUGUEL' ? 'Nome do Locatário' : 'Nome ou Razão Social'}</label>
            <input value={contraparte.name} onChange={(e) => setContraparte((c) => ({ ...c, name: e.target.value }))} className={fieldClass} placeholder="Ex: João da Silva / Empresa ME" />
          </div>
          <div>
            <label className={lblClass}>CPF / CNPJ</label>
            <input
              value={contraparte.document}
              onChange={(e) => setContraparte((c) => ({ ...c, document: e.target.value }))}
              onBlur={handleCnpjBlur}
              className={fieldClass}
              placeholder="000.000.000-00 ou 00.000.000/0000-00"
            />
            {lookupStatus === 'checking' && <p className="mt-1 text-[11px] text-[#6E6A61]">Verificando...</p>}
            {lookupStatus === 'found' && (
              <p className="mt-1 text-[11px] font-bold text-[#2F4A3C] dark:text-[#DFFFAE]">
                <Sparkles className="inline h-3 w-3 mr-1" /> Cliente Hexxa detectado — e-mail preenchido automaticamente, os lançamentos financeiros sincronizam nos dois lados.
              </p>
            )}
          </div>
          <div>
            <label className={lblClass}>Endereço Completo</label>
            <input value={contraparte.address} onChange={(e) => setContraparte((c) => ({ ...c, address: e.target.value }))} className={fieldClass} placeholder="Rua Exemplo, 123, Bairro, Cidade - UF" />
          </div>
          <div>
            <label className={lblClass}>E-mail (para assinatura eletrônica)</label>
            <input type="email" value={contraparte.email} onChange={(e) => setContraparte((c) => ({ ...c, email: e.target.value }))} className={fieldClass} placeholder="email@exemplo.com" />
          </div>

          {kind === 'SERVICO' && (
            <>
              <div>
                <label className={lblClass}>Descrição do Serviço</label>
                <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={`${fieldClass} resize-none`} placeholder="Ex: Consultoria contábil mensal..." />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={lblClass}>Valor Mensal (R$)</label>
                  <input value={valorServico} onChange={(e) => setValorServico(e.target.value)} className={fieldClass} placeholder="0,00" />
                </div>
                <div>
                  <label className={lblClass}>Dia de Vencimento</label>
                  <input type="number" min="1" max="31" value={dueDayServico} onChange={(e) => setDueDayServico(e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={lblClass}>Forma de Pagamento</label>
                <input value={formaPagamentoServico} onChange={(e) => setFormaPagamentoServico(e.target.value)} className={fieldClass} placeholder="Ex: PIX até o dia 5 de cada mês" />
              </div>
            </>
          )}

          {kind === 'MUTUO' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={lblClass}>Valor (R$)</label>
                  <input value={valorMutuo} onChange={(e) => setValorMutuo(e.target.value)} className={fieldClass} placeholder="0,00" />
                </div>
                <div>
                  <label className={lblClass}>Juros ao mês</label>
                  <input value={jurosAoMes} onChange={(e) => setJurosAoMes(e.target.value)} className={fieldClass} />
                </div>
              </div>
              <div>
                <label className={lblClass}>Forma de Pagamento</label>
                <input value={formaPagamentoMutuo} onChange={(e) => setFormaPagamentoMutuo(e.target.value)} className={fieldClass} placeholder="Ex: Parcela única no vencimento" />
              </div>
              <div>
                <label className={lblClass}>Prazo / Vencimento Final</label>
                <input value={prazoMutuo} onChange={(e) => setPrazoMutuo(e.target.value)} className={fieldClass} placeholder="Ex: 12 meses" />
              </div>
            </>
          )}

          {kind === 'ALUGUEL' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={lblClass}>Valor Mensal do Aluguel (R$)</label>
                <input value={monthlyRent} onChange={(e) => setMonthlyRent(e.target.value)} className={fieldClass} placeholder="0,00" />
              </div>
              <div>
                <label className={lblClass}>Índice de Reajuste</label>
                <select value={indexType} onChange={(e) => setIndexType(e.target.value as any)} className={fieldClass}>
                  <option value="IPCA">IPCA</option>
                  <option value="IGPM">IGP-M</option>
                </select>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={lblClass}>Data de Início</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label className={lblClass}>Data de Vigência Final</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={fieldClass} />
            </div>
          </div>
          <div>
            <label className={lblClass}>Local e Data (cabeçalho do contrato)</label>
            <input value={cityDate} onChange={(e) => setCityDate(e.target.value)} className={fieldClass} placeholder="Ex: São Paulo, SP, 15 de Outubro de 2026" />
          </div>
        </div>
      )}

      {/* Passo 3: origem do documento */}
      {step === 3 && kind && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-2">Como este contrato será formalizado?</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDocumentSource('AUTO')}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all ${documentSource === 'AUTO' ? 'border-[#1E3328] bg-[#1E3328] text-[#DFFFAE]' : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5'}`}
            >
              <FileText className="h-5 w-5" />
              <span className="text-xs font-bold">Gerar automaticamente e enviar para assinatura</span>
              <span className="text-[11px] font-normal opacity-80">O sistema monta o contrato padrão e manda por e-mail via DocuSeal.</span>
            </button>
            <button
              type="button"
              onClick={() => setDocumentSource('ALREADY_SIGNED')}
              className={`flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-all ${documentSource === 'ALREADY_SIGNED' ? 'border-[#1E3328] bg-[#1E3328] text-[#DFFFAE]' : 'border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5'}`}
            >
              <Upload className="h-5 w-5" />
              <span className="text-xs font-bold">Já está assinado fora do sistema</span>
              <span className="text-[11px] font-normal opacity-80">Só anexar o PDF já assinado — ativa e lança o financeiro na hora.</span>
            </button>
          </div>

          {documentSource === 'ALREADY_SIGNED' && (
            <div className="space-y-3 pt-2">
              <div>
                <label className={lblClass}>PDF Assinado</label>
                <input type="file" accept="application/pdf" onChange={(e) => setSignedFile(e.target.files?.[0] ?? null)} className={fieldClass} />
              </div>
              <div>
                <label className={lblClass}>Data da Assinatura</label>
                <input type="date" value={signingDate} onChange={(e) => setSigningDate(e.target.value)} className={fieldClass} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Passo 4: revisão */}
      {step === 4 && kind && (
        <div className="space-y-4 animate-in fade-in">
          <h3 className="font-serif font-bold text-sm text-[#231F20] dark:text-[#FEFDF3] mb-2">Revisão</h3>
          <div className="bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 rounded-2xl p-5 text-sm space-y-2">
            <p><strong>Tipo:</strong> {CONTRACT_KIND_LABEL[kind]}</p>
            <p><strong>Contraparte:</strong> {contraparte.name || '(vazio)'} {contraparte.email ? `— ${contraparte.email}` : ''}</p>
            {kind === 'ALUGUEL' && <p><strong>Imóvel:</strong> {propertyLabel() || '(vazio)'}</p>}
            <p><strong>Vigência:</strong> {startDate} a {endDate}</p>
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] italic mt-2">
              {documentSource === 'AUTO'
                ? 'O contrato ficará "Aguardando Assinatura" e só entra em vigor (com os lançamentos financeiros) quando a contraparte assinar.'
                : 'O contrato entra em vigor imediatamente, com os lançamentos financeiros gerados na hora.'}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mt-8 pt-6 border-t border-black/5 dark:border-white/10">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1 || loading}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] hover:bg-black/5 disabled:opacity-30 transition-all"
        >
          <ChevronLeft className="h-4 w-4" /> Voltar
        </button>

        {step < totalSteps ? (
          <button
            onClick={() => setStep((s) => Math.min(totalSteps, s + 1))}
            disabled={(step === 1 && !canAdvanceFromKind) || (step === 2 && kind === 'ALUGUEL' && !propertyId)}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-xs font-bold text-[#DFFFAE] bg-[#1E3328] hover:bg-[#2F4A3C] disabled:opacity-40 transition-all shadow-sm"
          >
            Avançar <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-bold text-[#DFFFAE] bg-[#1E3328] hover:bg-[#2F4A3C] transition-all shadow-sm"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {loading ? 'Enviando...' : documentSource === 'AUTO' ? 'Gerar e Enviar para Assinatura' : 'Registrar Contrato Ativo'}
          </button>
        )}
      </div>
    </div>
  );
}
