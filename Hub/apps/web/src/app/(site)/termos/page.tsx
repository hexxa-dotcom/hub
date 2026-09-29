import type { Metadata } from 'next';
import { PaginaLegal } from '@/components/site/PaginaLegal';
import { CONTRATO, TERMOS, VERSAO_CONTRATO, VERSAO_TERMOS } from '@/lib/contratos/textos';

export const metadata: Metadata = { title: 'Termos de uso e contrato | Hexx Digital' };

export default function Page() {
  return (
    <PaginaLegal
      titulo="Termos de uso e contrato de serviços"
      versao={`Termos ${VERSAO_TERMOS} · Contrato ${VERSAO_CONTRATO}`}
      blocos={[{ titulo: 'Termos de uso da plataforma', secoes: TERMOS }, { titulo: 'Contrato de prestação de serviços contábeis', secoes: CONTRATO }]}
    />
  );
}
