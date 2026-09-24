'use client';

import { useState, useTransition } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { salvarDescricaoDaAtividadeAction } from './actions';

/**
 * A ATIVIDADE, NAS PALAVRAS DA EMPRESA.
 *
 * O texto do CNAE é o da Receita ("Serviços combinados de escritório e apoio
 * administrativo") — correto, mas ninguém se apresenta assim. Aqui o
 * empresário escreve do jeito dele, e é isso que vai para o cartão e para o
 * link. Deixar vazio volta ao texto do CNAE, que continua aparecendo embaixo.
 */
export function DescricaoDaAtividade({
  descricao,
  cnaeTexto,
  cnaeCodigo,
}: {
  descricao: string | null;
  cnaeTexto: string | null;
  cnaeCodigo: string | null;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(descricao ?? '');
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const salvar = () =>
    iniciar(async () => {
      setErro(null);
      try {
        await salvarDescricaoDaAtividadeAction(texto);
        setEditando(false);
      } catch {
        setErro('Não consegui salvar. Tente de novo.');
      }
    });

  const cnae = [cnaeCodigo && `CNAE ${cnaeCodigo}`, cnaeTexto].filter(Boolean).join(' · ');

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <p className="rotulo text-ink-soft">O que a empresa faz</p>
        {!editando && (
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft transition-colors hover:text-ink"
          >
            <Pencil className="h-3 w-3" /> {descricao ? 'Editar' : 'Escrever do meu jeito'}
          </button>
        )}
      </div>

      {editando ? (
        <div className="mt-2">
          <input
            autoFocus
            value={texto}
            maxLength={120}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') salvar();
              if (e.key === 'Escape') setEditando(false);
            }}
            placeholder={cnaeTexto ?? 'Ex.: Consultoria em gestão para clínicas'}
            className="w-full border-b border-black/15 bg-transparent pb-2 text-base text-ink outline-none placeholder:text-ink-soft/60 focus:border-hexxa-forest dark:border-white/20 dark:focus:border-hexxa-lime"
          />
          <p className="mt-2 text-[11px] text-ink-soft">
            Uma frase curta, do jeito que você se apresenta. Em branco, vale o texto do CNAE. {texto.length}/120
          </p>
          <div className="mt-3 flex items-center gap-4">
            <button
              type="button"
              onClick={salvar}
              disabled={pendente}
              className="inline-flex items-center gap-2 rounded-full bg-hexxa-forest px-4 py-2 text-xs font-bold text-hexxa-lime disabled:opacity-60 dark:bg-hexxa-lime dark:text-hexxa-forest"
            >
              {pendente && <Loader2 className="h-3 w-3 animate-spin" />} Salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setTexto(descricao ?? '');
                setEditando(false);
              }}
              className="text-xs font-semibold text-ink-soft hover:text-ink"
            >
              Cancelar
            </button>
          </div>
          {erro && <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">{erro}</p>}
        </div>
      ) : (
        <p className="mt-2 text-base leading-relaxed text-ink">{descricao ?? cnaeTexto ?? 'Não informado'}</p>
      )}
      {cnae && <p className="mt-1 text-xs text-ink-soft">{cnae}</p>}
    </section>
  );
}
