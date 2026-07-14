'use client';

import React from 'react';

export default function DanfseLayout({ data, notaId, protocol }: { data: any; notaId: string; protocol: string }) {
  // Tenta extrair infNFSe (Nota) ou infDPS (DPS)
  const rootNfse = data.infNFSe || data;
  const rootDps = rootNfse.DPS?.infDPS || data.DPS?.infDPS || data.infDPS || rootNfse;
  
  // Extração segura de propriedades com base na estrutura real do XML Nacional
  const prest = rootNfse.emit || rootDps.prest || {};
  const toma = rootDps.toma || {};
  const serv = rootDps.serv || {};
  const valores = rootNfse.valores || rootDps.valores || {};
  
  const emissao = rootNfse.dhEmi || rootDps.dhEmi ? new Date(rootNfse.dhEmi || rootDps.dhEmi).toLocaleString('pt-BR') : 'N/A';
  const compet = rootDps.dCompet ? new Date(rootDps.dCompet).toLocaleDateString('pt-BR') : 'N/A';
  const vServ = valores?.vServPrest?.vServ || valores?.vLiq || '0.00';
  const descServ = serv?.cServ?.xDescServ || 'Nenhum serviço discriminado.';

  return (
    <div className="min-h-screen bg-slate-100 py-8 print:bg-white print:py-0 text-slate-800">
      
      {/* Botões de Ação (escondidos na impressão) */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-between items-center print:hidden px-4">
        <a href="/meu-negocio/notas" className="text-brand-600 hover:underline font-medium">&larr; Voltar para Notas</a>
        <button 
          onClick={() => window.print()}
          className="bg-brand-600 text-white px-4 py-2 rounded shadow hover:bg-brand-700 transition"
        >
          Imprimir / Salvar PDF
        </button>
      </div>

      {/* Papel A4 */}
      <div className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none min-h-[1122px] p-8 border border-slate-200">
        
        {/* CABEÇALHO */}
        <div className="border border-slate-800 p-4 mb-4 flex flex-col md:flex-row justify-between items-start md:items-center">
          <div>
            <h1 className="text-2xl font-bold uppercase">Nota Fiscal de Serviços Eletrônica - NFS-e</h1>
            <h2 className="text-sm font-semibold mt-1">Padrão Nacional de Emissão de NFS-e</h2>
            <div className="mt-2 text-xs">
              <p><strong>Data de Emissão:</strong> {emissao}</p>
              <p><strong>Competência:</strong> {compet}</p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 text-right">
            <p className="text-xs uppercase font-bold text-slate-500 mb-1">Chave de Acesso</p>
            <p className="font-mono text-sm font-semibold">{protocol}</p>
            <p className="text-xs text-slate-500 mt-2">Nº da Nota: {rootNfse?.nDPS || 'S/N'}</p>
          </div>
        </div>

        {/* PRESTADOR */}
        <div className="border border-slate-800 p-0 mb-4">
          <div className="bg-slate-100 border-b border-slate-800 px-3 py-1">
            <h3 className="font-bold text-sm uppercase">Prestador de Serviços</h3>
          </div>
          <div className="p-3 text-sm grid grid-cols-2 gap-4">
            <div>
              <p><strong>CPF/CNPJ:</strong> {prest?.CNPJ || prest?.CPF || 'N/A'}</p>
              <p><strong>Razão Social:</strong> {prest?.xNome || 'N/A'}</p>
            </div>
            <div>
              <p><strong>Município:</strong> {rootNfse?.cLocEmi || 'N/A'}</p>
              <p><strong>Optante Simples Nacional:</strong> {prest?.regTrib?.opSimpNac === 1 ? 'Sim' : 'Não'}</p>
            </div>
          </div>
        </div>

        {/* TOMADOR */}
        <div className="border border-slate-800 p-0 mb-4">
          <div className="bg-slate-100 border-b border-slate-800 px-3 py-1">
            <h3 className="font-bold text-sm uppercase">Tomador de Serviços</h3>
          </div>
          <div className="p-3 text-sm grid grid-cols-2 gap-4">
            <div>
              <p><strong>CPF/CNPJ:</strong> {toma?.CNPJ || toma?.CPF || 'N/A'}</p>
              <p><strong>Nome/Razão Social:</strong> {toma?.xNome || 'N/A'}</p>
            </div>
            <div>
              <p><strong>Email:</strong> {toma?.xEmail || toma?.email || 'N/A'}</p>
              <p><strong>Telefone:</strong> {toma?.xTelef || toma?.fone || 'N/A'}</p>
            </div>
          </div>
        </div>

        {/* SERVIÇO */}
        <div className="border border-slate-800 p-0 mb-4">
          <div className="bg-slate-100 border-b border-slate-800 px-3 py-1">
            <h3 className="font-bold text-sm uppercase">Discriminação dos Serviços</h3>
          </div>
          <div className="p-4 text-sm min-h-[150px] whitespace-pre-wrap">
            {descServ}
          </div>
        </div>

        {/* VALORES E IMPOSTOS */}
        <div className="border border-slate-800 p-0 mb-4">
          <div className="bg-slate-100 border-b border-slate-800 px-3 py-1">
            <h3 className="font-bold text-sm uppercase">Valores e Impostos</h3>
          </div>
          <div className="p-0 text-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="p-3 font-semibold">Valor do Serviço (R$)</th>
                  <th className="p-3 font-semibold">Base de Cálculo (R$)</th>
                  <th className="p-3 font-semibold">Alíquota ISS (%)</th>
                  <th className="p-3 font-semibold">Valor ISS (R$)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-3 font-mono font-medium">{Number(vServ).toFixed(2)}</td>
                  <td className="p-3 font-mono">{(valores?.vBC || vServ)}</td>
                  <td className="p-3 font-mono">{(valores?.pAliqAplic || serv?.cServ?.pAliq || 0)}%</td>
                  <td className="p-3 font-mono">{(valores?.vISSQN || valores?.trib?.tribMun?.vISSQN || '0.00')}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 border-t border-slate-800 p-3 text-right">
            <p className="text-lg">
              <strong>Valor Líquido da Nota: R$ </strong>
              <span className="font-mono">{Number(valores?.vLiq || vServ).toFixed(2)}</span>
            </p>
          </div>
        </div>

        {/* RODAPÉ */}
        <div className="mt-8 text-center text-xs text-slate-500">
          <p>Documento auxiliar gerado pelo Emissor de Notas Hexx Hub.</p>
          <p>Consulte a autenticidade no Portal Nacional da NFS-e utilizando a chave de acesso acima.</p>
        </div>

      </div>
    </div>
  );
}
