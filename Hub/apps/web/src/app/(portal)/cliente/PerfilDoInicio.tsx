'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { SlidersHorizontal, Loader2 } from 'lucide-react';
import { BLOCOS, PERFIS, type BlocoId, type PerfilDoInicio as Perfil } from './blocos';
import { salvarPerfilDoInicioAction } from './perfil-actions';

/**
 * "Ver: Básico · Personalizado · Completo" — quanto a Início mostra.
 * No Personalizado, a pessoa marca os blocos que quer ver.
 */
export function PerfilDoInicio({ perfil, visiveis, emLinha = false }: { perfil: Perfil; visiveis: BlocoId[]; emLinha?: boolean }) {
  const router = useRouter();
  const [atual, setAtual] = useState(perfil);
  const [escolhidos, setEscolhidos] = useState<BlocoId[]>(visiveis);
  const [editando, setEditando] = useState(emLinha && perfil === 'PERSONALIZADO');
  const [salvando, iniciar] = useTransition();

  // O servidor é quem manda: depois de salvar e atualizar, alinha com o que ficou gravado.
  const chaveDoServidor = `${perfil}:${visiveis.join()}`;
  useEffect(() => {
    setAtual(perfil);
    setEscolhidos(visiveis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDoServidor]);

  const salvar = (p: Perfil, blocos?: BlocoId[]) =>
    iniciar(async () => {
      setAtual(p);
      await salvarPerfilDoInicioAction(p, blocos);
      router.refresh();
    });

  const escolher = (p: Perfil) => {
    if (p === 'PERSONALIZADO') {
      setEditando(true);
      if (atual !== 'PERSONALIZADO') salvar('PERSONALIZADO', escolhidos);
      return;
    }
    setEditando(false);
    salvar(p);
  };

  const alternar = (id: BlocoId) => {
    const novo = escolhidos.includes(id) ? escolhidos.filter((b) => b !== id) : [...escolhidos, id];
    if (!novo.length) return; // pelo menos um bloco
    setEscolhidos(novo);
    salvar('PERSONALIZADO', novo);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <span className="text-xs text-ink-soft">Ver:</span>
        <div className="segmented-track inline-flex gap-1 rounded-full p-1">
          {PERFIS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => escolher(p.id)}
              aria-pressed={atual === p.id}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                atual === p.id ? 'bg-white text-ink shadow-sm dark:bg-white/15' : 'text-ink-soft hover:text-ink'
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        {atual === 'PERSONALIZADO' && (
          <button
            type="button"
            onClick={() => setEditando((e) => !e)}
            aria-expanded={editando}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:text-ink"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" /> Blocos
          </button>
        )}
        {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-soft" />}
      </div>

      {editando && atual === 'PERSONALIZADO' && (
        <div
          className={
            emLinha
              ? 'mt-3 max-w-md rounded-2xl border border-black/10 p-3 dark:border-white/10'
              : 'absolute right-0 z-30 mt-2 w-72 rounded-2xl border border-black/10 bg-white p-3 shadow-lg dark:border-white/10 dark:bg-[#121614]'
          }
        >
          <p className="mb-2 px-1 text-xs text-ink-soft">Marque o que quer ver na Início</p>
          <ul className="max-h-80 space-y-0.5 overflow-y-auto">
            {BLOCOS.map((b) => (
              <li key={b.id}>
                <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                  <input type="checkbox" checked={escolhidos.includes(b.id)} onChange={() => alternar(b.id)} className="h-4 w-4 accent-emerald-700" />
                  {b.rotulo}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
