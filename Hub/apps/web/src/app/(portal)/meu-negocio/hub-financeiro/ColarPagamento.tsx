'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { lerPagamentoColado, type PagamentoLido } from '@hexxa/core/pagamento-colado';
import { createLancamento } from './actions';

/**
 * COLAR O BOLETO OU O PIX E PRONTO.
 *
 * A pessoa cola a linha digitável ou o "Pix copia e cola"; a Hexx lê valor,
 * vencimento e quem recebe (ver `lerPagamentoColado`) e mostra a conta pronta
 * para confirmar. Só a descrição e a categoria ficam para ela — e já vêm
 * sugeridas.
 */

type Categoria = { id: string; name: string; kind: 'INCOME' | 'EXPENSE' };

const campo =
  'mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-hexxa-forest dark:border-white/10 dark:bg-white/5 dark:focus:border-hexxa-lime';
const rotulo = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-soft';

export function ColarPagamento({
  categorias,
  onClose,
  onSaved,
}: {
  categorias: Categoria[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [colado, setColado] = useState('');
  const [lido, setLido] = useState<PagamentoLido | null>(null);
  const [descricao, setDescricao] = useState('');
  const [valor, setValor] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
  }, []);

  function ler(texto: string) {
    setColado(texto);
    setErro(null);
    const r = lerPagamentoColado(texto);
    setLido(r);
    if (r) {
      setDescricao(r.sugestao);
      setValor(r.valor != null ? r.valor.toFixed(2).replace('.', ',') : '');
      setVencimento(r.vencimento ?? new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }));
    }
  }

  async function salvar() {
    const v = Number(valor.replace(/\./g, '').replace(',', '.'));
    if (!descricao.trim()) return setErro('Dê uma descrição à conta.');
    if (!Number.isFinite(v) || v <= 0) return setErro('Informe o valor.');
    if (!vencimento) return setErro('Informe o vencimento.');
    setSalvando(true);
    try {
      await createLancamento({
        tipo: 'PAGAR',
        descricao: descricao.trim(),
        valor: v,
        vencimento,
        categoriaId: categoriaId || undefined,
      });
      onSaved();
      onClose();
    } catch {
      setErro('Não consegui salvar. Tente de novo.');
    } finally {
      setSalvando(false);
    }
  }

  const despesas = categorias.filter((c) => c.kind === 'EXPENSE');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-3xl border border-black/5 bg-surface p-6 shadow-(--elev-3) dark:border-white/10"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">Colar boleto ou Pix</h2>
            <p className="mt-0.5 text-sm text-ink-soft">Cole a linha digitável ou o Pix copia e cola. O resto eu preencho.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-ink-soft hover:bg-black/5 hover:text-ink dark:hover:bg-white/10">
            <X className="h-4 w-4" />
          </button>
        </div>

        <textarea
          ref={areaRef}
          value={colado}
          onChange={(e) => ler(e.target.value)}
          rows={3}
          placeholder="34191.09008 00000.000000 00000.000000 1 15790000015000"
          className={`${campo} mt-4 resize-none font-mono text-xs`}
        />

        {colado && !lido && (
          <p className="mt-2 text-xs text-ink-soft">Não reconheci como boleto nem Pix. Confira se colou o código inteiro.</p>
        )}

        {lido && (
          <div className="mt-5 space-y-4">
            <p className="text-xs text-ink-soft">
              {lido.tipo === 'PIX' ? 'Pix' : lido.tipo === 'BOLETO' ? 'Boleto bancário' : 'Conta de consumo ou tributo'}
              {lido.favorecido ? ` · ${lido.favorecido}` : ''}
              {lido.valor == null ? ' · o código não traz o valor, informe abaixo' : ''}
            </p>
            <label className="block">
              <span className={rotulo}>Descrição</span>
              <input value={descricao} onChange={(e) => setDescricao(e.target.value)} className={campo} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className={rotulo}>Valor</span>
                <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0,00" className={campo} />
              </label>
              <label className="block">
                <span className={rotulo}>Vencimento</span>
                <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={campo} />
              </label>
            </div>
            <label className="block">
              <span className={rotulo}>Categoria (opcional)</span>
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={campo}>
                <option value="">A classificação automática decide</option>
                {despesas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            {erro && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-hexxa-forest px-5 py-3 text-sm font-bold text-hexxa-lime disabled:opacity-50"
            >
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Lançar conta a pagar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
