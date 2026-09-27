'use client';

import { useState, useTransition } from 'react';
import { Sparkles } from 'lucide-react';
import { salvarEnquadramentoAction, sugerirEnquadramentoAction } from './actions';

/**
 * O enquadramento no Simples que o contador marca — anexo e Fator R.
 *
 * Só manda enquanto não há apuração do OneFlow; depois dela, a apuração
 * prevalece e esta marcação fica como referência. A IA sugere pelo CNAE, e a
 * sugestão só aparece como "conferida" se uma segunda leitura concordar.
 */
export function EnquadramentoForm({
  companyId,
  anexoInicial,
  fatorRInicial,
  apurado,
}: {
  companyId: string;
  anexoInicial: string | null;
  fatorRInicial: string | null;
  apurado: string | null;
}) {
  const [anexo, setAnexo] = useState(anexoInicial ?? '');
  const [fatorR, setFatorR] = useState(fatorRInicial ?? '');
  const [msg, setMsg] = useState<string | null>(null);
  const [sugestao, setSugestao] = useState<Awaited<ReturnType<typeof sugerirEnquadramentoAction>> | null>(null);
  const [pendente, iniciar] = useTransition();
  const campo = 'w-full rounded-full border border-black/15 bg-transparent px-4 py-2 text-sm text-ink dark:border-white/20';

  return (
    <div className="space-y-4">
      {apurado && (
        <p className="text-xs text-ink-soft">
          A apuração do OneFlow diz <strong className="text-ink">{apurado}</strong> — ela prevalece sobre a marcação abaixo.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="rotulo text-ink-soft">Anexo</span>
          <select value={anexo} onChange={(e) => setAnexo(e.target.value)} className={campo}>
            <option value="">A confirmar</option>
            <option value="III">Anexo III</option>
            <option value="IV">Anexo IV</option>
            <option value="V">Anexo V</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="rotulo text-ink-soft">Fator R</span>
          <select value={anexo === 'IV' ? 'NAO_SUJEITO' : anexo === 'V' ? 'SUJEITO' : fatorR} disabled={anexo === 'IV' || anexo === 'V'} onChange={(e) => setFatorR(e.target.value)} className={campo}>
            <option value="">Não sei</option>
            <option value="SUJEITO">Sujeita ao Fator R (III ou V)</option>
            <option value="NAO_SUJEITO">Não se sujeita</option>
          </select>
        </label>
      </div>

      {sugestao && (
        <p className={`text-xs ${sugestao.ok ? 'text-ink' : 'text-ink-soft'}`}>
          {sugestao.ok ? (
            <>
              <strong>Sugestão{sugestao.conferida ? ' conferida' : ' (sem confirmação)'}:</strong> Anexo {sugestao.anexo},{' '}
              {sugestao.fatorR === 'SUJEITO' ? 'sujeita ao Fator R' : 'sem Fator R'}. {sugestao.motivo}
            </>
          ) : (
            sugestao.mensagem
          )}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await salvarEnquadramentoAction(companyId, anexo as 'III' | 'IV' | 'V' | '', fatorR as 'SUJEITO' | 'NAO_SUJEITO' | '');
              setMsg(r.mensagem);
            })
          }
          className="rounded-full bg-hexxa-forest px-5 py-2 text-xs font-semibold text-hexxa-lime disabled:opacity-50 dark:bg-hexxa-lime dark:text-hexxa-forest"
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const s = await sugerirEnquadramentoAction(companyId);
              setSugestao(s);
              if (s.ok && s.conferida && s.anexo) {
                setAnexo(s.anexo);
                setFatorR(s.fatorR ?? '');
              }
            })
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-black/15 px-4 py-2 text-xs font-semibold text-ink disabled:opacity-50 dark:border-white/20"
        >
          <Sparkles className="h-3.5 w-3.5" /> Sugerir pela atividade
        </button>
      </div>
      {msg && <p className="text-xs text-ink-soft">{msg}</p>}
    </div>
  );
}
