'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Spinner, ArrowRight, CheckCircle, Certificate, PencilSimple, Warning } from '@phosphor-icons/react';
import { completeOnboardingAction, cadastrarPeloCertificado, type OnboardingState, type EstadoDoCertificado } from './actions';
import { formatDocument, normalizeDocument, isCompleteDocument } from '@hexxa/core/document-br';
import { CampoSenha, CampoTelefone, VoltarNoCanto, campoCadastro } from './CamposDoCadastro';

const initialState: OnboardingState = { ok: true, message: '' };

const caixa = 'rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8';
const rotulo = 'mb-1.5 block text-xs font-medium text-black/60';
const botaoPrimario =
  'mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40';

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
      <FormularioManual
        companyName={companyName}
        existingCompanyId={existingCompanyId}
        voltar={existingCompanyId ? undefined : () => setModo(null)}
      />
    );
  }
  if (modo === 'certificado') return <PeloCertificado voltar={() => setModo(null)} />;

  const opcao =
    'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:border-black';

  return (
    <div className={caixa}>
      <p className="text-base font-semibold">Você tem o certificado digital da empresa?</p>
      <p className="mt-1 text-sm text-black/60">
        É o arquivo .pfx (e-CNPJ A1) usado para emitir nota. Com ele, eu preencho quase tudo sozinho.
      </p>
      <div className="mt-5 space-y-2.5">
        <button type="button" onClick={() => setModo('certificado')} className={`${opcao} border-black/40`}>
          <Certificate className="mt-0.5 h-6 w-6 shrink-0" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">Sim, tenho o certificado</span>
            <span className="mt-0.5 block text-xs text-black/60">
              Envio o arquivo e a senha. CNPJ, responsável e nota fiscal vêm dele.
            </span>
          </span>
          <ArrowRight className="mt-1 h-4 w-4 text-black/40" />
        </button>
        <button type="button" onClick={() => setModo('manual')} className={`${opcao} border-black/10`}>
          <PencilSimple className="mt-0.5 h-6 w-6 shrink-0 text-black/60" />
          <span className="flex-1">
            <span className="block text-sm font-semibold">Não tenho agora</span>
            <span className="mt-0.5 block text-xs text-black/60">
              Informo o CNPJ e meus dados. A nota fiscal eu configuro no passo seguinte.
            </span>
          </span>
          <ArrowRight className="mt-1 h-4 w-4 text-black/40" />
        </button>
      </div>
    </div>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <p className="flex items-start gap-1.5 rounded-xl border border-black/15 bg-black/[0.03] p-3 text-sm">
      <Warning className="mt-0.5 h-4 w-4 shrink-0" />
      {texto}
    </p>
  );
}

function PeloCertificado({ voltar }: { voltar: () => void }) {
  const [estado, action, pendente] = useActionState<EstadoDoCertificado, FormData>(cadastrarPeloCertificado, {
    ok: true,
    message: '',
  });

  if (estado.ok && estado.empresa) {
    const pronto = Boolean(estado.perfil);
    return (
      <div className={`${caixa} text-center`}>
        <CheckCircle className="mx-auto mb-3 h-10 w-10" weight="fill" />
        <p className="text-lg font-semibold">{estado.empresa.razaoSocial}</p>
        <p className="mt-1 text-sm text-black/60">Responsável: {estado.empresa.responsavel}</p>
        {pronto ? (
          <p className="mt-4 text-sm text-black/70">
            Nota fiscal configurada pela sua última nota: <strong>{estado.perfil!.nome}</strong>
            {estado.perfil!.item ? ` (item ${estado.perfil!.item}` : ''}
            {estado.perfil!.aliquota != null
              ? `, ISS ${String(estado.perfil!.aliquota).replace('.', ',')}%)`
              : estado.perfil!.item
                ? ')'
                : ''}
            . Suas notas emitidas já entram como faturamento.
          </p>
        ) : (
          <p className="mt-4 text-sm text-black/70">
            Empresa cadastrada e certificado salvo. {estado.message} Falta só configurar a nota fiscal.
          </p>
        )}
        <Link href={(pronto ? '/onboarding/ponto-de-partida' : '/onboarding/fiscal') as never} className={`${botaoPrimario} mt-6`}>
          {pronto ? 'Último passo' : 'Configurar a nota fiscal'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <>
      <VoltarNoCanto onClick={voltar} />
      <div className={caixa}>
        <form action={action} className="space-y-4">
          <div>
            <p className="text-base font-semibold">Certificado digital</p>
            <p className="mt-1 text-sm text-black/60">
              Do arquivo eu tiro o CNPJ, o responsável e o CPF, e busco suas notas no Emissor Nacional.
            </p>
          </div>
          <input
            type="file"
            name="pfx"
            accept=".pfx,.p12"
            required
            className="block text-sm text-black/70 file:mr-3 file:rounded-full file:border file:border-black/15 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-black hover:file:border-black"
          />
          <div>
            <label htmlFor="senha" className={rotulo}>Senha do certificado</label>
            <CampoSenha id="senha" name="senha" />
          </div>
          <div>
            <label htmlFor="celular" className={rotulo}>Seu celular (WhatsApp)</label>
            <CampoTelefone id="celular" name="celular" />
          </div>
          {!estado.ok && estado.message && <Erro texto={estado.message} />}
          <button type="submit" disabled={pendente} className={botaoPrimario}>
            {pendente ? (
              <>
                <Spinner className="h-5 w-5 animate-spin" /> Lendo o certificado e buscando suas notas…
              </>
            ) : (
              <>
                Cadastrar minha empresa <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </>
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
    <>
      {voltar && <VoltarNoCanto onClick={voltar} />}
      <div className={caixa}>
        <form action={formAction} className="space-y-4">
          {existingCompanyId && <input type="hidden" name="existingCompanyId" value={existingCompanyId} />}
          <div>
            <p className="text-base font-semibold">Sua empresa</p>
            <p className="mt-1 text-sm text-black/60">
              Informe o CNPJ de {companyName}. Busco os dados na Receita e preencho o cadastro e a base fiscal.
            </p>
          </div>
          {!state.ok && state.message && <Erro texto={state.message} />}

          <div>
            <label htmlFor="cnpj" className={rotulo}>CNPJ da empresa</label>
            <input
              id="cnpj"
              name="cnpj"
              type="text"
              placeholder="00.000.000/0001-00"
              value={cnpj}
              onChange={(e) => handleChange(e.target.value)}
              required
              className={campoCadastro}
            />
          </div>
          {consultando && (
            <p className="flex items-center gap-2 text-sm text-black/50">
              <Spinner className="h-4 w-4 animate-spin" /> Consultando a Receita…
            </p>
          )}
          {preview?.razaoSocial && (
            <div className="flex items-start gap-2 rounded-xl border border-black/15 p-3 text-sm">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" weight="fill" />
              <span>
                <strong>{preview.razaoSocial}</strong>
                {preview.municipio ? ` — ${preview.municipio}` : ''}
              </span>
            </div>
          )}

          {/*
            Quem responde pela empresa. O OneFlow exige CPF e celular para
            criar a empresa lá quando o contador aprovar o cadastro.
          */}
          <div className="grid gap-3 pt-2">
            <p className="text-sm font-semibold">Responsável pela empresa</p>
            <div>
              <label htmlFor="nome" className={rotulo}>Nome completo</label>
              <input id="nome" name="nome" type="text" placeholder="Como no documento" autoComplete="name" required className={campoCadastro} />
            </div>
            <div>
              <label htmlFor="cpf" className={rotulo}>CPF</label>
              <CampoCpf />
            </div>
            <div>
              <label htmlFor="celular" className={rotulo}>Celular (WhatsApp)</label>
              <CampoTelefone id="celular" name="celular" />
            </div>
          </div>

          <button type="submit" disabled={pending || !isCompleteDocument(cnpj)} className={botaoPrimario}>
            {pending ? (
              <Spinner className="h-5 w-5 animate-spin" />
            ) : (
              <>
                Continuar <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </>
  );
}

/** 000.000.000-00 enquanto digita, no máximo 11 dígitos. */
function CampoCpf() {
  const [valor, setValor] = useState('');
  const mascara = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  };
  return (
    <input
      id="cpf"
      name="cpf"
      type="text"
      inputMode="numeric"
      placeholder="000.000.000-00"
      maxLength={14}
      required
      value={valor}
      onChange={(e) => setValor(mascara(e.target.value))}
      className={campoCadastro}
    />
  );
}
