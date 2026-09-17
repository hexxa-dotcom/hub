'use client';

import { Card, CardHeader } from '@/components/ui/Card';
import { SealCheck } from '@phosphor-icons/react';

type HealthScoreCardProps = {
  tudoEmDia: boolean;
  fatorR: number;
  anexo: string;
  /** versão reduzida, pra caber lado a lado com outros cards num grid de 3 colunas */
  compact?: boolean;
};

/**
 * Atenção: os itens abaixo são texto fixo, não verificação real — só
 * `tudoEmDia`, `anexo` e `fatorR` vêm de dado apurado. Enquanto for assim,
 * o card não deve afirmar conformidade com mais força do que isso sustenta.
 */
function itens(anexo: string, fatorR: number) {
  return [
    'Simples Nacional em conformidade',
    `Anexo ${anexo} · Fator R ${(fatorR * 100).toFixed(1)}%`,
    'Certidões (CND) vigentes',
  ];
}

export function HealthScoreCard({ tudoEmDia, fatorR, anexo, compact = false }: HealthScoreCardProps) {
  const status = tudoEmDia ? 'Conforme' : 'Atenção';

  return (
    <Card level={1} className="flex flex-col justify-between">
      <div>
        <CardHeader
          label="Saúde fiscal"
          icon={SealCheck}
          aside={
            <span
              className={`text-caption font-semibold uppercase ${
                tudoEmDia ? 'text-ok dark:text-hexxa-lime' : 'text-warn'
              }`}
            >
              {status}
            </span>
          }
        />

        {/* Sem ícone por linha: três checks idênticos em sequência não
            informam nada que a lista já não diga. */}
        <ul className="mt-6 space-y-3 border-l border-line pl-4">
          {itens(anexo, fatorR).map((t) => (
            <li key={t} className="text-footnote text-ink-soft">
              {t}
            </li>
          ))}
        </ul>
      </div>

      {!compact && (
        <p className="text-caption uppercase text-ink-soft mt-6 border-t border-line pt-5">
          Monitoramento contábil ativo
        </p>
      )}
    </Card>
  );
}
