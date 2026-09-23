'use client';

import { useActionState, useState } from 'react';
import { Buildings, Spinner, ArrowRight, ArrowLeft, CheckCircle, Certificate, PencilSimple, Warning } from '@phosphor-icons/react';
import Link from 'next/link';
import { completeOnboardingAction, cadastrarPeloCertificado, type OnboardingState, type EstadoDoCertificado } from './actions';
import { formatDocument, normalizeDocument, isCompleteDocument } from '@hexxa/core/document-br';

const initialState: OnboardingState = { ok: true, message: '' };

const cartao = 'rounded-3xl border border-white/20 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-white/10';
const campo =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white';
const botaoPrimario =
  'group mt-2 flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 font-medium text-white transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50';

/**
 * O COMEÇO DO CADASTRO: PRIMEIRO, O CERTIFICADO.
 *
 * Quem tem o e-CNPJ não digita quase nada: o arquivo traz CNPJ, responsável
 * e CPF, e com ele o Hub já busca no Emissor Nacional a última nota e
 * configura a emissão — pula direto para o último passo. Quem não tem segue
 * pelo formulário, e a nota fiscal é configurada à mão no passo seguinte.
 */
export function OnboardingForm({ companyName, existingCompanyId }: { companyName: string; existingCompanyId?: string }) {
  // Empresa legada, só completando o CNPJ: o certificado não se aplica.
  const [modo, setModo] = useState<'certificado' | 'manual' | null>(existingCompanyId ? 'manual' : null);

  if (modo === 'manual') {
    return (
      <FormularioManual companyName={companyName} existingCompanyId={existingCompanyId} voltar={existingCompanyId ? undefined : () => setModo(null)} />
    );
  }
  if (modo === 'certificado') return <PeloCertificado voltar={() => setModo(null)} />;

  return (
    <div className="w-full max-w-md">
      <Cabecalho texto="Vamos deixar sua empresa pronta em poucos minutos." />
      <div className={cartao}>
        <p className="text-base font-semibold text-slate-900 dark:text-white">
          Você tem o certificado digital da empresa?
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          É o arquivo .pfx (e-CNPJ A1) usado para emitir nota. Com ele, eu preencho quase tudo sozinho.
        </p>
        <div className="mt-5 space-y-2.5">
          <button type="button" onClick={() => setModo('certificado')} className="flex w-full items-start gap-3 rounded-2xl border border-brand-600/40 bg-brand-600/5 p-4 text-left transition-colors hover:border-brand-600">
            <Certificate className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">Sim, tenho o certificado</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Envio o arquivo e a senha. CNPJ, responsável e nota fiscal vêm dele.
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
          </button>
          <button type="button" onClick={() => setModo('manual')} className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:border-brand-600 dark:border-slate-700">
            <PencilSimple className="mt-0.5 h-6 w-6 shrink-0 text-slate-500" />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-slate-900 dark:text-white">Não tenho agora</span>
              <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                Informo o CNPJ e meus dados. A nota fiscal eu configuro no passo seguinte.
              </span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Cabecalho({ texto }: { texto: React.ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-xl">
        <Buildings className="h-8 w-8 text-white" />
      </div>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">Bem-vindo ao Hexx Hub</h1>
      <p className="text-sm text-white/75">{texto}</p>
    </div>
  );
}

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-white/80 dark:hover:text-white">
      <ArrowLeft className="h-3.5 w-3.5" /> Voltar
    </button>
  );
}

function PeloCertificado({ voltar }: { voltar: () => void }) {
  const [estado, action, pendente] = useActionState<EstadoDoCertificado, FormData>(cadastrarPeloCertificado, { ok: true, message: '' });

  if (estado.ok && estado.empresa) {
    const pronto = Boolean(estado.perfil);
    return (
      <div className="w-full max-w-md">
        <div className={`${cartao} text-center`}>
          <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" weight="fill" />
          <p className="text-lg font-semibold text-slate-900 dark:text-white">{estado.empresa.razaoSocial}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Responsável: {estado.empresa.responsavel}</p>
          {pronto ? (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Nota fiscal configurada pela sua última nota: <strong>{estado.perfil!.nome}</strong>
              {estado.perfil!.item ? ` (item ${estado.perfil!.item}` : ''}
              {estado.perfil!.aliquota != null ? `, ISS ${String(estado.perfil!.aliquota).replace('.', ',')}%)` : estado.perfil!.item ? ')' : ''}.
              Suas notas emitidas já entram como faturamento.
            </p>
          ) : (
            <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
              Empresa cadastrada e certificado salvo. {estado.message} Falta só configurar a nota fiscal.
            </p>
          )}
          <Link
            href={(pronto ? '/onboarding/ponto-de-partida' : '/onboarding/fiscal') as never}
            className={botaoPrimario}
          >
            {pronto ? 'Último passo' : 'Configurar a nota fiscal'}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <Voltar onClick={voltar} />
      <div className={cartao}>
        <form action={action} className="space-y-4">
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">Certificado digital</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Do arquivo eu tiro o CNPJ, o responsável e o CPF, e busco suas notas no Emissor Nacional.
            </p>
          </div>
          <input
            type="file"
            name="pfx"
            accept=".pfx,.p12"
            required
            className="block text-sm text-slate-600 file:mr-3 file:rounded-full file:border-0 file:bg-brand-600/10 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 dark:text-slate-300"
          />
          <div>
            <label htmlFor="senha" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Senha do certificado</label>
            <input id="senha" name="senha" type="password" autoComplete="off" required className={campo} />
          </div>
          <div>
            <label htmlFor="celular" className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">Seu celular (WhatsApp)</label>
            <input id="celular" name="celular" type="tel" placeholder="(00) 00000-0000" autoComplete="tel" required className={campo} />
          </div>
          {!estado.ok && estado.message && (
            <p className="flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              <Warning className="mt-0.5 h-4 w-4 shrink-0" />
              {estado.message}
            </p>
          )}
          <button type="submit" disabled={pendente} className={botaoPrimario}>
            {pendente ? (
              <>
                <Spinner className="mr-2 h-5 w-5 animate-spin" /> Lendo o certificado e buscando suas notas…
              </>
            ) : (
              <>
                Cadastrar minha empresa <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function FormularioManual({
  companyName,
  existingCompanyId,
  voltar,
}: {
  companyName: string;
  existingCompanyId?: string;
  voltar?: () => void;
}) {
  const [state, formAction, pending] = useActionState(completeOnboardingAction, initialState);
  const [cnpj, setCnpj] = useState('');
  const [preview, setPreview] = useState<{ razaoSocial: string; municipio: string | null } | null>(null);
  const [consultando, setConsultando] = useState(false);

  // Preview automático: ao completar 14 dígitos, mostra a razão social encontrada.
  async function handleChange(v: string) {
    const masked = formatDocument(v);
    setCnpj(masked);
    if (isCompleteDocument(masked)) {
      setConsultando(true);
      setPreview(null);
      try {
        const res = await fetch(`/api/cnpj/${normalizeDocument(masked)}`);
        if (res.ok) {
          const d = await res.json();
          setPreview({ razaoSocial: d.razaoSocial, municipio: d.municipio ?? null });
        }
      } catch {
        // preview é cortesia — a validação real acontece no submit
      } finally {
        setConsultando(false);
      }
    } else {
      setPreview(null);
    }
  }

  return (
    <div className="w-full max-w-md">
      {voltar && <Voltar onClick={voltar} />}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 shadow-xl">
          <Buildings className="h-8 w-8 text-white" />
        </div>
        <h1 className="mb-2 text-2xl font-semibold tracking-tight text-white">
          Bem-vindo ao Hexx Hub
        </h1>
        <p className="text-sm text-white/75">
          Informe o CNPJ de <strong>{companyName}</strong> — buscamos os dados na Receita
          e preenchemos o cadastro da empresa e a base fiscal para você.
        </p>
      </div>

      <div className="rounded-3xl border border-white/20 bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border-white/10">
        <form action={formAction} className="space-y-4">
          {existingCompanyId && <input type="hidden" name="existingCompanyId" value={existingCompanyId} />}
          {!state.ok && state.message && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {state.message}
            </div>
          )}

          <div>
            <label htmlFor="cnpj" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              CNPJ da empresa
            </label>
            <input
              id="cnpj"
              name="cnpj"
              type="text"
              placeholder="00.000.000/0001-00 (ou alfanumérico)"
              value={cnpj}
              onChange={(e) => handleChange(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          {/*
            Quem responde pela empresa. O OneFlow exige CPF e celular para
            criar a empresa lá quando o contador aprovar o cadastro.
          */}
          <div className="grid gap-3 pt-1">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Responsável pela empresa</p>
            {[
              { id: 'nome', label: 'Nome completo', type: 'text', placeholder: 'Como no documento', auto: 'name' },
              { id: 'cpf', label: 'CPF', type: 'text', placeholder: '000.000.000-00', auto: 'off' },
              { id: 'celular', label: 'Celular (WhatsApp)', type: 'tel', placeholder: '(00) 00000-0000', auto: 'tel' },
            ].map((c) => (
              <div key={c.id}>
                <label htmlFor={c.id} className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  {c.label}
                </label>
                <input
                  id={c.id}
                  name={c.id}
                  type={c.type}
                  placeholder={c.placeholder}
                  autoComplete={c.auto}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                />
              </div>
            ))}
          </div>

          {consultando && (
            <p className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner className="h-4 w-4 animate-spin" /> Consultando a Receita…
            </p>
          )}
          {preview?.razaoSocial && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <strong>{preview.razaoSocial}</strong>
                {preview.municipio ? ` — ${preview.municipio}` : ''}
              </span>
            </div>
          )}

          <button
            type="submit"
            disabled={pending || !isCompleteDocument(cnpj)}
            className="group mt-2 flex w-full items-center justify-center rounded-xl bg-brand-600 px-4 py-3 font-medium text-white transition-all hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <Spinner className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Configurar minha empresa
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-white/60">
        Depois de enviar, o escritório valida o cadastro antes de liberar o acesso.
      </p>
    </div>
  );
}
