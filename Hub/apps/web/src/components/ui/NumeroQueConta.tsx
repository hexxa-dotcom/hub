'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * O número do card de destaque conta até o total — só na primeira vez do dia
 * em cada card, e só quando a tela abre (o card ainda invisível, antes da
 * própria entrada) — num valor já pintado, voltar a zero seria um piscar. Número
 * financeiro é para ler: depois da primeira vez, fica parado.
 */

const PADRAO = /^(.*?)(-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?)(.*)$/;

export function NumeroQueConta({ texto, chave }: { texto: string; chave: string }) {
  const [mostrado, setMostrado] = useState(texto);
  const quadro = useRef<number | null>(null);
  const el = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    // O card ainda invisível (antes da própria entrada) = a tela acabou de
    // abrir navegando. Já visível = carga da página ou re-render: não conta.
    const cartao = el.current?.closest('.entrada-grade > *');
    if (!cartao || Number(getComputedStyle(cartao).opacity) > 0.5) return setMostrado(texto);
    const m = texto.match(PADRAO);
    if (!m || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setMostrado(texto);
    const hoje = new Date().toLocaleDateString('en-CA');
    const k = `hexx.contou.${chave}`;
    try {
      if (localStorage.getItem(k) === hoje) return setMostrado(texto);
      localStorage.setItem(k, hoje);
    } catch {
      return setMostrado(texto);
    }
    const [, antes, numero, depois] = m as unknown as [string, string, string, string];
    const casas = numero.includes(',') ? numero.split(',')[1]!.length : 0;
    const alvo = Number(numero.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(alvo) || alvo === 0) return setMostrado(texto);
    const fmt = (v: number) => `${antes}${v.toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })}${depois}`;
    const inicio = performance.now();
    const duracao = 700;
    setMostrado(fmt(0));
    const passo = (t: number) => {
      const p = Math.min(1, (t - inicio) / duracao);
      const suave = 1 - Math.pow(1 - p, 3);
      setMostrado(p < 1 ? fmt(alvo * suave) : texto);
      if (p < 1) quadro.current = requestAnimationFrame(passo);
    };
    quadro.current = requestAnimationFrame(passo);
    return () => {
      if (quadro.current) cancelAnimationFrame(quadro.current);
    };
  }, [texto, chave]);

  return <span ref={el}>{mostrado}</span>;
}
