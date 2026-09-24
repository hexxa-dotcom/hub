'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Check, Loader2, X } from 'lucide-react';
import { assinarNoHubAction, marcarQueAssineiAction, signatarioAction } from './contratos-actions';

const DocusealForm = dynamic(() => import('@docuseal/react').then((m) => m.DocusealForm), { ssr: false });

/**
 * ASSINAR UM CONTRATO — sem sair do Hub.
 *
 * Quando a outra parte também usa o Hub, a assinatura é do próprio Hub: lê o
 * contrato, confirma nome e CPF, marca que leu e concorda, e assina. Ficam
 * registrados data, hora, IP e o código (hash) do PDF.
 *
 * Quando a outra parte está fora, a assinatura é no DocuSeal — embutido aqui
 * mesmo, sem e-mail nem outra aba.
 */

export interface ContratoParaAssinar {
  id: string;
  title: string;
  partyName: string;
  signatureMethod: 'HUB' | 'DOCUSEAL' | 'FORA' | null;
  ownSignUrl: string | null;
}

const campo =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-hexxa-forest dark:border-white/10 dark:bg-white/5 dark:focus:border-hexxa-lime';

function mascaraCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function AssinarContrato({
  contrato,
  onClose,
  onDone,
}: {
  contrato: ContratoParaAssinar;
  onClose: () => void;
  onDone: (mensagem: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [concordo, setConcordo] = useState(false);
  const [assinando, setAssinando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const noHub = contrato.signatureMethod === 'HUB';

  useEffect(() => {
    if (!noHub) return;
    signatarioAction().then((s) => {
      setNome(s.nome);
      setCpf(mascaraCpf(s.cpf));
    });
  }, [noHub]);

  async function assinar() {
    setErro(null);
    setAssinando(true);
    try {
      const r = await assinarNoHubAction(contrato.id, nome, cpf);
      if (!r.ok) return setErro(r.message);
      onDone(r.message);
    } catch {
      setErro('Não consegui assinar agora. Tente de novo.');
    } finally {
      setAssinando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-black/5 bg-surface shadow-(--elev-3) dark:border-white/10"
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-6 py-5 dark:border-white/10">
          <div className="min-w-0">
            <p className="rotulo text-ink-soft">Assinar contrato</p>
            <h2 className="mt-1 truncate text-lg font-light uppercase tracking-[0.04em] text-ink">{contrato.title}</h2>
            <p className="text-xs text-ink-soft">com {contrato.partyName}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        {noHub ? (
          <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto md:grid-cols-[1fr_340px] md:overflow-hidden">
            {/* O contrato ocupa quase a tela toda: dá para ler inteiro sem baixar. */}
            <iframe title="Contrato" src={`/api/contratos/${contrato.id}/pdf#navpanes=0&view=FitH`} className="h-[70vh] w-full border-0 bg-white md:h-full" />
            <div className="flex flex-col justify-between gap-6 overflow-y-auto p-6">
              <div className="space-y-4">
                <label className="block">
                  <span className="rotulo text-ink-soft">Seu nome completo</span>
                  <input value={nome} onChange={(e) => setNome(e.target.value)} className={campo} />
                </label>
                <label className="block">
                  <span className="rotulo text-ink-soft">Seu CPF</span>
                  <input value={cpf} onChange={(e) => setCpf(mascaraCpf(e.target.value))} inputMode="numeric" placeholder="000.000.000-00" className={campo} />
                </label>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm text-ink">
                  <input type="checkbox" checked={concordo} onChange={(e) => setConcordo(e.target.checked)} className="mt-0.5 h-4 w-4 rounded" />
                  <span>Li o contrato e concordo com ele, e assino em nome da minha empresa.</span>
                </label>
                <p className="text-[11px] leading-relaxed text-ink-soft">
                  Ficam registrados data, hora, IP e o código do documento. Assinatura eletrônica válida entre as partes (MP
                  2.200-2/2001 e Lei 14.063/2020).
                </p>
              </div>
              <div>
                {erro && <p className="mb-3 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
                <button
                  type="button"
                  onClick={assinar}
                  disabled={!concordo || assinando}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-3 text-sm font-bold text-hexxa-lime transition-opacity disabled:opacity-40 dark:bg-hexxa-lime dark:text-hexxa-forest"
                >
                  {assinando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Assinar
                </button>
              </div>
            </div>
          </div>
        ) : contrato.ownSignUrl ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DocusealForm
              src={contrato.ownSignUrl}
              language="pt"
              withTitle={false}
              withSendCopyButton={false}
              onComplete={async () => {
                await marcarQueAssineiAction(contrato.id);
                onDone(`Assinado. Agora falta ${contrato.partyName}, que recebeu o contrato por e-mail.`);
              }}
            />
          </div>
        ) : (
          <p className="p-8 text-sm text-ink-soft">Sua empresa já assinou. Falta {contrato.partyName}.</p>
        )}
      </div>
    </div>
  );
}
