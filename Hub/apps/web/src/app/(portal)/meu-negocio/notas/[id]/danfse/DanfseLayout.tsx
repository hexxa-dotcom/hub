'use client';

import React from 'react';
import type { DanfseData } from '@/lib/server/danfse';
import { regimeLabel, type DanfseEndereco } from '@/lib/danfse-shared';
import { NFSE_LOGO_BASE64 } from '@/lib/nfse-logo';

const brl = (v: number) => v.toFixed(2);
const dash = (v: string) => (v ? v : '-');
const dashN = (v: number) => (v ? brl(v) : '-');
const dashPct = (v: number) => (v ? `${brl(v)}%` : '-');
const enderecoLinha = (e: DanfseEndereco) =>
  [e.logradouro, e.numero, e.complemento, e.bairro, e.cep].filter(Boolean).join(', ') || '-';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-slate-700 text-white text-[11px] font-bold uppercase tracking-wide px-2 py-1 print:bg-slate-700 print:text-white">
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid border border-t-0 border-slate-400" style={{ gridTemplateColumns: `repeat(${React.Children.count(children)}, 1fr)` }}>{children}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 border-r border-slate-400 last:border-r-0 text-[11px]">
      <p className="text-[8px] font-bold uppercase text-slate-500 mb-0.5">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function FullField({ label, value, borderBottom }: { label: string; value: string; borderBottom?: boolean }) {
  return (
    <div className={`p-2 border border-t-0 border-slate-400 text-[11px] ${borderBottom ? '' : 'border-b-0'}`}>
      <p className="text-[8px] font-bold uppercase text-slate-500 mb-0.5">{label}</p>
      <p>{value}</p>
    </div>
  );
}

export default function DanfseLayout({ data, qrDataUrl }: { data: DanfseData; qrDataUrl: string }) {
  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0 text-slate-800">
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden px-4">
        <a href="/meu-negocio/notas" className="text-brand-600 hover:underline font-medium">&larr; Voltar para Notas</a>
        <button
          onClick={() => window.print()}
          className="bg-brand-600 text-white px-4 py-2 rounded shadow hover:bg-brand-700 transition"
        >
          Imprimir / Salvar PDF
        </button>
      </div>

      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none p-6 border border-slate-200 text-[11px]">
        {data.homologacao && (
          <div className="mb-3 border-2 border-red-600 bg-red-50 text-red-700 text-center font-bold py-1.5 uppercase tracking-wide text-xs">
            Ambiente de Homologação — Documento sem valor fiscal
          </div>
        )}

        {/* CABEÇALHO */}
        <div className="flex justify-between items-start mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={NFSE_LOGO_BASE64} alt="NFS-e" className="h-7" />
          <div className="flex-1 text-center">
            <h1 className="text-sm font-bold">Documento Auxiliar da NFS-e</h1>
            <p className="text-[10px]">Padrão Nacional de Emissão de NFS-e</p>
          </div>
          <div className="flex flex-col items-end">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR Code de verificação" className="w-14 h-14" />
            <p className="text-[8px] text-slate-500">Verificar autenticidade</p>
          </div>
        </div>

        <div className="border border-slate-400 bg-slate-100 p-2 mt-2 mb-2">
          <p className="text-[8px] font-bold uppercase text-slate-500">Chave de Acesso da NFS-e</p>
          <p className="font-mono text-sm tracking-wide">{data.chaveAcesso}</p>
        </div>

        <Grid>
          <Field label="Número da NFS-e" value={data.numero} />
          <Field label="Competência" value={data.competencia} />
          <Field label="Data e Hora da Emissão" value={data.dataEmissao} />
        </Grid>
        <Grid>
          <Field label="Município" value={data.prestador.municipio} />
          <Field label="Ambiente" value={data.homologacao ? 'Homologação (teste)' : 'Produção'} />
        </Grid>

        {/* PRESTADOR */}
        <div className="mt-3">
          <SectionTitle>Prestador de Serviços</SectionTitle>
          <Grid>
            <Field label="CNPJ / CPF" value={dash(data.prestador.documento)} />
            <Field label="Regime Tributário" value={regimeLabel(data.prestador.regime)} />
          </Grid>
          <FullField label="Nome / Nome Empresarial" value={dash(data.prestador.nome)} />
          <FullField
            label="Endereço"
            value={data.prestador.endereco ? enderecoLinha(data.prestador.endereco) : '-'}
            borderBottom
          />
        </div>

        {/* TOMADOR */}
        <div className="mt-3">
          <SectionTitle>Tomador de Serviços</SectionTitle>
          <Grid>
            <Field label="CNPJ / CPF" value={dash(data.tomador.documento)} />
            <Field label="E-mail" value={dash(data.tomador.email)} />
          </Grid>
          <FullField label="Nome / Nome Empresarial" value={dash(data.tomador.nome)} />
          <FullField
            label="Endereço"
            value={data.tomador.endereco ? enderecoLinha(data.tomador.endereco) : '-'}
            borderBottom
          />
        </div>

        {/* SERVIÇO */}
        <div className="mt-3">
          <SectionTitle>Serviço Prestado</SectionTitle>
          <Grid>
            <Field label="Código de Tributação Nacional" value={dash(data.codigoTributacaoNacional)} />
            <Field label="Local da Prestação" value={dash(data.localPrestacao)} />
          </Grid>
          <div className="p-2 border border-t-0 border-slate-400 min-h-[60px]">
            {!!data.descricaoTributacaoNacional && (
              <p className="text-[9px] text-slate-500 mb-1">{data.descricaoTributacaoNacional}</p>
            )}
            <p className="text-[8px] font-bold uppercase text-slate-500 mb-0.5">Descrição do Serviço</p>
            <p className="whitespace-pre-wrap">{data.descricaoServico}</p>
          </div>
        </div>

        {/* TRIBUTAÇÃO MUNICIPAL */}
        <div className="mt-3">
          <SectionTitle>Tributação Municipal (ISSQN)</SectionTitle>
          <Grid>
            <Field label="BC ISSQN (R$)" value={dashN(data.valores.baseCalculo)} />
            <Field label="Alíquota Aplicada" value={dashPct(data.valores.aliquotaIss)} />
            <Field label="Retenção do ISSQN" value={data.issRetido ? 'Retido' : 'Não Retido'} />
            {/* ISS apurado é sempre um resultado calculado de verdade (mesmo
                quando dá zero, como em nota isenta) — nunca "-", diferente de
                BC/alíquota que podem genuinamente não se aplicar (ex.: MEI). */}
            <Field label="ISSQN Apurado (R$)" value={brl(data.valores.valorIss)} />
          </Grid>
          {data.issRetido && (
            <p className="px-2 py-1 text-[10px] text-amber-700 bg-amber-50 border-x border-b border-slate-400">
              ISS retido pelo tomador dos serviços.
            </p>
          )}
        </div>

        {/* IBS/CBS */}
        <div className="mt-3">
          <SectionTitle>Tributação IBS / CBS (Reforma Tributária — LC 214/2025)</SectionTitle>
          <Grid>
            <Field label="CST / Classificação Tributária" value={`${dash(data.ibsCbs.cst)} / ${dash(data.ibsCbs.classTrib)}`} />
            <Field label="Local de Incidência" value={dash(data.ibsCbs.localIncidencia)} />
          </Grid>
          <Grid>
            <Field
              label="Alíquota IBS UF / Efetiva"
              value={`${dashPct(data.ibsCbs.aliquotaIbsUf)} / ${dashPct(data.ibsCbs.aliquotaEfetivaIbsUf)}`}
            />
            <Field label="Valor Apurado IBS UF (R$)" value={dashN(data.ibsCbs.valorIbsUf)} />
          </Grid>
          <Grid>
            <Field
              label="Alíquota IBS Município / Efetiva"
              value={`${dashPct(data.ibsCbs.aliquotaIbsMun)} / ${dashPct(data.ibsCbs.aliquotaEfetivaIbsMun)}`}
            />
            <Field label="Valor Apurado IBS Município (R$)" value={dashN(data.ibsCbs.valorIbsMun)} />
          </Grid>
          <Grid>
            <Field
              label="Alíquota CBS / Efetiva"
              value={`${dashPct(data.ibsCbs.aliquotaCbs)} / ${dashPct(data.ibsCbs.aliquotaEfetivaCbs)}`}
            />
            <Field
              label="Valor Total Apurado (IBS + CBS) (R$)"
              value={dashN(data.ibsCbs.valorIbsTotal + data.ibsCbs.valorCbs)}
            />
          </Grid>
        </div>

        {/* VALOR TOTAL */}
        <div className="mt-3">
          <SectionTitle>Valor Total da NFS-e</SectionTitle>
          <Grid>
            <Field label="Valor da Operação / Serviço (R$)" value={brl(data.valores.valorServico)} />
            <Field label="Valor Líquido da NFS-e (R$)" value={brl(data.valores.valorLiquido)} />
          </Grid>
          <div className="border border-t-0 border-slate-400 bg-slate-100 p-2 text-right">
            <span className="font-bold mr-2">Valor Líquido da Nota:</span>
            <span className="font-mono text-base font-bold">R$ {brl(data.valores.valorLiquido)}</span>
          </div>
        </div>

        {data.valores.tributosAproximados > 0 && (
          <div className="mt-3">
            <SectionTitle>Informações Complementares</SectionTitle>
            <p className="p-2 border border-t-0 border-slate-400 text-[10px] text-slate-600">
              Totais aproximados dos tributos cfe. Lei nº 12.741/2012: R$ {brl(data.valores.tributosAproximados)}.
            </p>
          </div>
        )}

        {/* RODAPÉ */}
        <div className="mt-6 text-center text-[9px] text-slate-500">
          <p>Documento auxiliar sem validade fiscal por si só — a NFS-e válida é o XML assinado digitalmente.</p>
          <p>Consulte a autenticidade no Portal Nacional da NFS-e (nfse.gov.br) utilizando a chave de acesso ou o QR Code acima.</p>
          <p className="mt-1 text-slate-400 font-semibold">Emitido através do sistema Hexx Hub Gestão Digital</p>
        </div>
      </div>
    </div>
  );
}
