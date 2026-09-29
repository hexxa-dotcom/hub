'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Entrada das seções: opacidade 0 + 18px → visível ao entrar na tela.
 * Filhos de [data-stagger] entram em sequência (80 ms). Sem animação com
 * prefers-reduced-motion. Mesma regra do protótipo do handoff.
 */
export function RevealRoot() {
  const pathname = usePathname();
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const els = new Set<HTMLElement>();
    document.querySelectorAll<HTMLElement>('.hx section > div > *').forEach((e) => {
      if (!e.hasAttribute('data-stagger')) els.add(e);
    });
    document.querySelectorAll<HTMLElement>('.hx [data-stagger] > *').forEach((e) => els.add(e));
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((en) => {
          if (!en.isIntersecting) return;
          const t = en.target as HTMLElement;
          t.style.opacity = '1';
          t.style.transform = 'none';
          io.unobserve(t);
        }),
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((e) => {
      if (e.dataset.revelado || e.closest('[data-sem-reveal]')) return;
      e.dataset.revelado = '1';
      const pai = e.parentElement!;
      const i = [...pai.children].indexOf(e) * (pai.hasAttribute('data-stagger') ? 1 : 0.6);
      e.style.opacity = '0';
      e.style.transform = 'translateY(18px)';
      e.style.transition = `opacity .7s cubic-bezier(.2,.7,.2,1) ${i * 80}ms, transform .7s cubic-bezier(.2,.7,.2,1) ${i * 80}ms`;
      io.observe(e);
    });
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
