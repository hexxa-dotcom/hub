import { ForaDoPlano } from '@/components/plano/ForaDoPlano';

/** Trava do módulo pelo plano da empresa — ver `lib/plano-acesso.ts`. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return <ForaDoPlano modulo="contratos">{children}</ForaDoPlano>;
}
