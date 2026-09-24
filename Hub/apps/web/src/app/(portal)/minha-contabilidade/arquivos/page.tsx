import { SectionHero } from '@/components/ui/SectionHero';
import { getTenantContext } from '@/lib/server/tenant';
import { listarDocumentos, checklist, extrasDosDocumentos } from '@/lib/server/documentos-da-empresa';
import { ArquivosClient } from './ArquivosClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Documentos da Empresa · Hexx Digital' };

export default async function Page() {
  const ctx = await getTenantContext();
  const [docs, extras] = await Promise.all([listarDocumentos(ctx), extrasDosDocumentos(ctx)]);
  const essencial = checklist(docs);
  const emDia = essencial.filter((e) => e.situacao === 'EM_DIA').length;

  return (
    <div className="w-full space-y-16 pb-20">
      <SectionHero
        title="Documentos da Empresa"
        subtitulo={`${emDia} de ${essencial.length} documentos essenciais em dia`}
        infoTitle="Sobre os Documentos da Empresa"
        infoDescription="Tudo o que a empresa precisa ter guardado, num lugar só: o que você sobe, o que a contabilidade envia pela Central, o certificado digital e os contratos. As certidões avisam antes de vencer."
      />
      <ArquivosClient docs={docs} essencial={essencial} extras={extras} />
    </div>
  );
}
