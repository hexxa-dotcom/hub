'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowLeft, CheckCircle, Spinner, UploadSimple, Warning, Certificate, FileCode, ChatCircleText } from '@phosphor-icons/react';
import {
  salvarFiscal,
  lerNotaEnviada,
  enviarCertificado,
  pedirAoContador,
  type EstadoFiscal,
  type EstadoDaLeitura,
} from './actions';

const inicial: EstadoFiscal = { ok: true, message: '' };
const inicialLeitura: EstadoDaLeitura = { ok: true, message: '', lido: null };

type Dados = {
  razaoSocial: string | null;
  cnae: string | null;
  optanteSimples: boolean;
  itemListaServico: string;
  aliquotaIss: number | null;
  codigoTributacaoMunicipio: string;
};

type Caminho = 'certificado' | 'nota' | 'nunca';

const cartao =
  'rounded-3xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-[#231F20] sm:p-8';
const titulo = 'font-serif text-xl font-bold text-[#231F20] dark:text-[#F5F6F4]';
const suave = 'text-sm text-[#6E6A61] dark:text-[#A8A49C]';
const botao =
  'inline-flex items-center justify-center gap-1.5 rounded-full bg-[#2F4A3C] px-5 py-3 text-sm font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]';

/**
 * PASSO 2: TRÊS CAMINHOS, DO MAIS FÁCIL AO QUE PRECISA DO CONTADOR.
 *
 * O certificado vem primeiro porque resolve tudo de uma vez: sem ele o Hub
 * não lê as notas no Emissor Nacional, e o faturamento nunca chega sozinho.
 * Quem não tem o arquivo à mão envia o XML da última nota. Quem nunca emitiu
 * não tem de onde copiar — o contador assume.
 */
export function FiscalOnboardingForm({ dados }: { dados: Dados }) {
  const [caminho, setCaminho] = useState<Caminho | null>(null);

  if (caminho === 'certificado') return <PeloCertificado voltar={() => setCaminho(null)} irParaNota={() => setCaminho('nota')} />;
  if (caminho === 'nunca') return <PrimeiraNota voltar={() => setCaminho(null)} />;
  if (caminho === 'nota') {
    return (
      <div className="space-y-3">
        <Voltar onClick={() => setCaminho(null)} />
        <FormularioDaNota dados={dados} />
      </div>
    );
  }

  const opcoes: { id: Caminho; icone: React.ReactNode; titulo: string; texto: string; destaque?: boolean }[] = [
    {
      id: 'certificado',
      icone: <Certificate className="h-6 w-6" />,
      titulo: 'Tenho o certificado digital',
      texto: 'Envie o arquivo e eu busco suas notas no Emissor Nacional. Não precisa digitar nada.',
      destaque: true,
    },
    {
      id: 'nota',
      icone: <FileCode className="h-6 w-6" />,
      titulo: 'Tenho o XML da última nota',
      texto: 'Envie a nota que você já emitiu e eu preencho o serviço e o ISS.',
    },
    {
      id: 'nunca',
      icone: <ChatCircleText className="h-6 w-6" />,
      titulo: 'Nunca emiti nota fiscal',
      texto: 'Seu contador cuida do certificado e da configuração para você.',
    },
  ];

  return (
    <div className={cartao}>
      <h2 className={titulo}>Sua nota fiscal</h2>
      <p className={`mt-1 ${suave}`}>
        Já trouxemos da Receita o CNPJ, o município{dados.cnae ? `, o CNAE ${dados.cnae}` : ''} e o
        regime{dados.optanteSimples ? ' (Simples Nacional)' : ''}. Como prefere configurar a emissão?
      </p>
      <div className="mt-5 space-y-2.5">
        {opcoes.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setCaminho(o.id)}
            className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors hover:border-[#2F4A3C] dark:hover:border-[#DFFFAE] ${
              o.destaque
                ? 'border-[#2F4A3C]/40 bg-[#EFFFD6]/60 dark:border-[#DFFFAE]/40 dark:bg-[#2F4A3C]/30'
                : 'border-black/10 dark:border-white/10'
            }`}
          >
            <span className="mt-0.5 text-[#2F4A3C] dark:text-[#DFFFAE]">{o.icone}</span>
            <span className="flex-1">
              <span className="block text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
                {o.titulo}
                {o.destaque && <span className="ml-2 text-xs font-semibold text-[#2F4A3C] dark:text-[#DFFFAE]">mais rápido</span>}
              </span>
              <span className="mt-0.5 block text-xs text-[#6E6A61] dark:text-[#A8A49C]">{o.texto}</span>
            </span>
            <ArrowRight className="mt-1 h-4 w-4 text-[#6E6A61]" />
          </button>
        ))}
      </div>
    </div>
  );
}

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E6A61] hover:text-[#231F20] dark:text-[#A8A49C]">
      <ArrowLeft className="h-3.5 w-3.5" /> Outra forma
    </button>
  );
}

function Concluido({ titulo: t, detalhe }: { titulo: string; detalhe?: React.ReactNode }) {
  return (
    <div className={`${cartao} text-center`}>
      <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" weight="fill" />
      <h2 className={titulo}>{t}</h2>
      {detalhe && <div className={`mt-2 ${suave}`}>{detalhe}</div>}
      <Link href="/onboarding/ponto-de-partida" className={`mt-5 ${botao}`}>
        Último passo <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function PeloCertificado({ voltar, irParaNota }: { voltar: () => void; irParaNota: () => void }) {
  const [estado, action, pendente] = useActionState(enviarCertificado, { ok: true, message: '' });

  if (estado.ok && estado.perfil) {
    return (
      <Concluido
        titulo="Nota fiscal configurada"
        detalhe={
          <>
            <p>{estado.message}</p>
            <p className="mt-2">
              Perfil padrão: <strong>{estado.perfil.nome}</strong> — item {estado.lido?.itemListaServico}
              {estado.lido?.aliquotaIss != null ? `, ISS ${String(estado.lido.aliquotaIss).replace('.', ',')}%` : ''}.
            </p>
            <p className="mt-2 text-xs">Suas notas emitidas também passam a entrar sozinhas como faturamento.</p>
          </>
        }
      />
    );
  }

  const certificadoSalvo = !estado.ok && estado.message.startsWith('Certificado salvo');

  return (
    <div className="space-y-3">
      <Voltar onClick={voltar} />
      <form action={action} className={cartao}>
        <h2 className={titulo}>Certificado digital</h2>
        <p className={`mt-1 ${suave}`}>
          O arquivo .pfx (A1) da empresa e a senha dele. Com ele eu leio no Emissor Nacional as notas que
          você já emitiu e configuro a emissão pela última.
        </p>
        <input
          type="file"
          name="pfx"
          accept=".pfx,.p12"
          required
          className="mt-5 block text-xs text-[#6E6A61] file:mr-2 file:rounded-full file:border-0 file:bg-[#EFFFD6] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#2F4A3C] dark:text-[#A8A49C] dark:file:bg-[#2F4A3C] dark:file:text-[#DFFFAE]"
        />
        <label className="mt-4 block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">Senha do certificado</span>
          <input
            type="password"
            name="senha"
            required
            autoComplete="off"
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]"
          />
        </label>
        {!estado.ok && estado.message && (
          <p className="mt-4 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {estado.message}
          </p>
        )}
        {certificadoSalvo && (
          <button type="button" onClick={irParaNota} className="mt-2 text-xs font-bold text-[#2F4A3C] underline dark:text-[#DFFFAE]">
            Enviar o XML da última nota
          </button>
        )}
        <button type="submit" disabled={pendente} className={`mt-6 w-full ${botao}`}>
          {pendente ? <Spinner className="h-4 w-4 animate-spin" /> : null}
          {pendente ? 'Buscando suas notas…' : 'Enviar e configurar'}
        </button>
      </form>
    </div>
  );
}

function PrimeiraNota({ voltar }: { voltar: () => void }) {
  const [estado, setEstado] = useState<{ ok: boolean; message: string } | null>(null);
  const [pendente, setPendente] = useState(false);

  if (estado?.ok) return <Concluido titulo="Deixa com a gente" detalhe={<p>{estado.message}</p>} />;

  return (
    <div className="space-y-3">
      <Voltar onClick={voltar} />
      <div className={cartao}>
        <h2 className={titulo}>Primeira nota fiscal</h2>
        <p className={`mt-1 ${suave}`}>
          Para emitir, a empresa precisa de um certificado digital e da configuração do serviço na
          prefeitura. Seu contador providencia as duas coisas — você só confirma aqui.
        </p>
        {estado && !estado.ok && <p className="mt-4 text-xs text-red-700 dark:text-red-400">{estado.message}</p>}
        <button
          type="button"
          disabled={pendente}
          onClick={async () => {
            setPendente(true);
            try {
              setEstado(await pedirAoContador());
            } catch {
              setEstado({ ok: false, message: 'Não consegui avisar o contador. Tente de novo.' });
            } finally {
              setPendente(false);
            }
          }}
          className={`mt-6 w-full ${botao}`}
        >
          {pendente ? <Spinner className="h-4 w-4 animate-spin" /> : null}
          Pedir ao meu contador
        </button>
      </div>
    </div>
  );
}

function FormularioDaNota({
  dados,
}: {
  dados: {
    razaoSocial: string | null;
    cnae: string | null;
    optanteSimples: boolean;
    itemListaServico: string;
    aliquotaIss: number | null;
    codigoTributacaoMunicipio: string;
  };
}) {
  const [estado, action, pendente] = useActionState(salvarFiscal, inicial);
  const [leitura, lerAction, lendo] = useActionState(lerNotaEnviada, inicialLeitura);

  /**
   * Os campos são controlados porque a leitura da nota os preenche DEPOIS da
   * primeira renderização — `defaultValue` ignoraria o que veio do XML.
   */
  const [item, setItem] = useState(dados.itemListaServico);
  const [aliquota, setAliquota] = useState(
    dados.aliquotaIss === null ? '' : String(dados.aliquotaIss),
  );
  const [codigoMun, setCodigoMun] = useState(dados.codigoTributacaoMunicipio);

  useEffect(() => {
    if (!leitura.lido) return;
    // Só sobrescreve o que a nota trouxe: se ela não informa a alíquota
    // (Simples sem retenção), o que a pessoa já digitou continua valendo.
    if (leitura.lido.itemListaServico) setItem(leitura.lido.itemListaServico);
    if (leitura.lido.aliquotaIss !== null) setAliquota(String(leitura.lido.aliquotaIss));
    if (leitura.lido.codigoTributacaoMunicipio) setCodigoMun(leitura.lido.codigoTributacaoMunicipio);
  }, [leitura]);

  const campo =
    'mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-[#231F20] dark:text-[#F5F6F4]';

  if (estado.ok && estado.message) {
    return (
      <div className="rounded-3xl border border-black/5 bg-white p-8 text-center dark:border-white/10 dark:bg-[#231F20]">
        <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" weight="fill" />
        <h2 className="font-serif text-xl font-bold text-[#231F20] dark:text-[#F5F6F4]">
          {estado.message}
        </h2>
        <Link
          href="/onboarding/ponto-de-partida"
          className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#2F4A3C] px-5 py-2.5 text-sm font-bold text-[#DFFFAE] dark:bg-[#DFFFAE] dark:text-[#231F20]"
        >
          Último passo <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <>
      {/*
        Formulário próprio para a leitura da nota. Os campos do upload ficam
        dentro do formulário principal, mas pertencem a este pelo atributo
        `form` — dois <form> aninhados não existem em HTML, e enviar a nota não
        pode submeter (nem validar) o cadastro inteiro.
      */}
      <form id="ler-nota" action={lerAction} className="hidden" />

    <form
      action={action}
      className="rounded-3xl border border-black/5 bg-white p-6 dark:border-white/10 dark:bg-[#231F20] sm:p-8"
    >
      <h2 className="font-serif text-xl font-bold text-[#231F20] dark:text-[#F5F6F4]">
        Sua nota fiscal
      </h2>
      <p className="mt-1 text-sm text-[#6E6A61] dark:text-[#A8A49C]">
        Já trouxemos da Receita o CNPJ, o município{dados.cnae ? `, o CNAE ${dados.cnae}` : ''} e o
        regime{dados.optanteSimples ? ' (Simples Nacional)' : ''}. Faltam duas coisas que só a
        prefeitura sabe.
      </p>

      <div className="mt-5 rounded-2xl border border-dashed border-black/15 p-4 dark:border-white/15">
        <p className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
          Tem uma nota que você já emitiu?
        </p>
        <p className="mt-0.5 text-xs text-[#6E6A61] dark:text-[#A8A49C]">
          Envie o XML e eu preencho tudo daqui. Você só confere.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="file"
            name="nota"
            accept=".xml,text/xml,application/xml"
            form="ler-nota"
            className="text-xs text-[#6E6A61] file:mr-2 file:rounded-full file:border-0 file:bg-[#EFFFD6] file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-[#2F4A3C] dark:text-[#A8A49C] dark:file:bg-[#2F4A3C] dark:file:text-[#DFFFAE]"
          />
          <button
            type="submit"
            form="ler-nota"
            disabled={lendo}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1.5 text-xs font-bold text-[#231F20] disabled:opacity-40 dark:border-white/10 dark:text-[#F5F6F4]"
          >
            {lendo ? <Spinner className="h-3.5 w-3.5 animate-spin" /> : <UploadSimple className="h-3.5 w-3.5" />}
            Ler nota
          </button>
        </div>
        {leitura.message && (
          <p
            className={`mt-2 text-xs ${
              leitura.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'
            }`}
          >
            {leitura.message}
          </p>
        )}
      </div>

      <input type="hidden" name="descricaoServico" value={leitura.lido?.descricaoServico ?? ''} />

      <div className="mt-6 space-y-5">
        <label className="block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Item da lista de serviços (LC 116)
          </span>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            É o que descreve seu serviço na nota. Ex.: 17.19 para contabilidade, 4.01 para medicina,
            1.07 para suporte de TI. Está na sua nota antiga ou com a prefeitura.
          </p>
          <input
            name="itemListaServico"
            required
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="17.19"
            className={campo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Alíquota de ISS do seu município
          </span>
          <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">
            Entre 2% e 5%, definida por lei municipal para o seu tipo de serviço.
          </p>
          <input
            name="aliquotaIss"
            inputMode="decimal"
            required
            value={aliquota}
            onChange={(e) => setAliquota(e.target.value)}
            placeholder="5"
            className={campo}
          />
        </label>

        <label className="block">
          <span className="text-sm font-bold text-[#231F20] dark:text-[#F5F6F4]">
            Código de tributação do município{' '}
            <span className="font-normal text-[#6E6A61] dark:text-[#A8A49C]">— se houver</span>
          </span>
          <input
            name="codigoTributacaoMunicipio"
            value={codigoMun}
            onChange={(e) => setCodigoMun(e.target.value)}
            className={campo}
          />
        </label>
      </div>

      {!estado.ok && estado.message && (
        <p className="mt-4 flex items-start gap-1.5 text-xs text-red-700 dark:text-red-400">
          <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {estado.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pendente}
        className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-[#2F4A3C] px-5 py-3 text-sm font-bold text-[#DFFFAE] disabled:opacity-40 dark:bg-[#DFFFAE] dark:text-[#231F20]"
      >
        {pendente ? <Spinner className="h-4 w-4 animate-spin" /> : null}
        Continuar
      </button>

    </form>
    </>
  );
}
