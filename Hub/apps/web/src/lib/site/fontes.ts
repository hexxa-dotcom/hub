import { Sora, JetBrains_Mono } from 'next/font/google';

/** Fontes da marca (site e telas de acesso). */
export const sora = Sora({ subsets: ['latin'], weight: ['300', '400', '600', '700'], variable: '--font-sora', display: 'swap' });
export const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono', display: 'swap' });
