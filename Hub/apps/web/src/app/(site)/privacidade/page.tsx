import type { Metadata } from 'next';
import { PaginaLegal } from '@/components/site/PaginaLegal';
import { CONTRATO, TERMOS, VERSAO_TERMOS } from '@/lib/contratos/textos';

export const metadata: Metadata = { title: 'Política de privacidade | Hexx Digital' };

/** As cláusulas de dados pessoais dos termos e do contrato (LGPD). */
export default function Page() {
  const dados = [...TERMOS, ...CONTRATO].filter((s) => /dados|lavagem/i.test(s.titulo));
  return <PaginaLegal titulo="Política de privacidade" versao={VERSAO_TERMOS} blocos={[{ secoes: dados }]} />;
}
