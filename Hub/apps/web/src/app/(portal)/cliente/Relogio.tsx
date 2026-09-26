'use client';

import { useEffect, useState } from 'react';

/** A hora agora, no fuso de São Paulo, atualizada a cada meio minuto. */
export function Relogio() {
  const agora = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const [hora, setHora] = useState<string | null>(null);
  useEffect(() => {
    setHora(agora());
    const t = setInterval(() => setHora(agora()), 30000);
    return () => clearInterval(t);
  }, []);
  return <span className="tabular">{hora ?? ''}</span>;
}
