'use client';

import { useState } from 'react';
import { Download, Eye, CheckCircle2, Clock } from 'lucide-react';
import { salvarContratoGeradoAction } from './actions';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export type ClienteOpcao = { id: string; razao: string; cnpj: string; responsavel: string; email: string; municipio: string; uf: string };
export type PlanoOpcao = { nome: string; valor: number };

const SERVICOS_OPCOES = [
  'Escrituração contábil mensal',
  'Apuração de impostos (Simples Nacional)',
  'Apuração de impostos (Lucro Presumido)',
  'Emissão de guias de recolhimento (DAS, DARF, GPS)',
  'Folha de pagamento e eSocial',
  'Elaboração e entrega de declarações fiscais (DEFIS, PGDAS)',
  'Elaboração de DRE e relatórios gerenciais',
  'Orientação e consultoria tributária',
  'Abertura e encerramento de empresa',
  'Gestão de pró-labore e distribuição de lucros',
];

type Contrato = {
  id: string;
  cliente: string;
  plano: string;
  valor: number;
  inicio: string;
  geradoEm: string;
  status: 'ativo' | 'cancelado';
};

export type ContratoGerado = Contrato;

const fi = 'w-full rounded-2xl border border-black/10 dark:border-white/10 bg-[#FEFDF3] dark:bg-[#121614] px-3.5 py-2.5 text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3] outline-none transition-colors focus:border-[#2F4A3C]';

function gerarContratoHTML(dados: {
  cliente: ClienteOpcao; plano: string; valor: number;
  inicio: string; vigencia: string; servicos: string[]; obs: string;
}) {
  const hoje = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
  const vigLabel = dados.vigencia === '12' ? '12 (doze) meses' : dados.vigencia === '6' ? '6 (seis) meses' : 'indeterminado';

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Contrato de Prestação de Serviços Contábeis</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.8; color: #111; max-width: 750px; margin: 40px auto; padding: 0 40px; }
  h1 { font-size: 15pt; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .subtitle { text-align: center; font-size: 11pt; color: #555; margin-bottom: 32px; }
  .clause { margin-bottom: 20px; }
  .clause-title { font-weight: bold; margin-bottom: 4px; }
  .parties { background: #f8f8f8; border: 1px solid #ddd; padding: 16px 20px; border-radius: 4px; margin-bottom: 24px; }
  .parties p { margin-bottom: 4px; }
  .valor { font-size: 14pt; font-weight: bold; }
  .assinaturas { margin-top: 60px; display: flex; justify-content: space-between; gap: 40px; }
  .assina { flex: 1; border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 10pt; }
  ul { padding-left: 24px; }
  li { margin-bottom: 4px; }
  .rodape { margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; text-align: center; font-size: 9pt; color: #888; }
  @media print { body { margin: 20mm; } }
</style>
</head>
<body>
<h1>Contrato de Prestação de Serviços Contábeis</h1>
<p class="subtitle">Plano ${dados.plano} · ${BRL.format(dados.valor)}/mês</p>

<div class="parties">
  <p><strong>CONTRATANTE:</strong> ${dados.cliente.razao}</p>
  <p><strong>CNPJ:</strong> ${dados.cliente.cnpj}</p>
  <p><strong>Representante:</strong> ${dados.cliente.responsavel}</p>
  <p><strong>E-mail:</strong> ${dados.cliente.email}</p>
  <p><strong>Município:</strong> ${dados.cliente.municipio}/${dados.cliente.uf}</p>
</div>
<div class="parties">
  <p><strong>CONTRATADA:</strong> Hexxa Contabilidade LTDA</p>
  <p><strong>CNPJ:</strong> 00.000.000/0001-99</p>
  <p><strong>Representante:</strong> Filipe Heck</p>
  <p><strong>E-mail:</strong> suporte@hexxa.com.br</p>
</div>

<div class="clause">
  <p class="clause-title">CLÁUSULA 1ª — DO OBJETO</p>
  <p>O presente contrato tem por objeto a prestação de serviços contábeis mensais pela CONTRATADA à CONTRATANTE, compreendendo os seguintes serviços:</p>
  <ul style="margin-top: 8px;">
    ${dados.servicos.map(s => `<li>${s}</li>`).join('\n    ')}
  </ul>
</div>

<div class="clause">
  <p class="clause-title">CLÁUSULA 2ª — DA REMUNERAÇÃO</p>
  <p>Pelos serviços prestados, a CONTRATANTE pagará à CONTRATADA o valor de <span class="valor">${BRL.format(dados.valor)}</span> mensais, a ser pago até o 5º (quinto) dia útil de cada mês, via PIX, boleto bancário ou cartão de crédito.</p>
</div>

<div class="clause">
  <p class="clause-title">CLÁUSULA 3ª — DO PRAZO</p>
  <p>O presente contrato vigorará por prazo ${vigLabel}, com início em ${new Date(dados.inicio + 'T12:00:00').toLocaleDateString('pt-BR')}, renovando-se automaticamente por igual período salvo manifestação contrária de qualquer das partes com antecedência mínima de 30 dias.</p>
</div>

<div class="clause">
  <p class="clause-title">CLÁUSULA 4ª — DAS OBRIGAÇÕES DA CONTRATANTE</p>
  <p>A CONTRATANTE obriga-se a fornecer à CONTRATADA todos os documentos, informações e dados necessários para a execução dos serviços, com pontualidade e precisão. O não fornecimento tempestivo exime a CONTRATADA de responsabilidade por eventuais atrasos.</p>
</div>

<div class="clause">
  <p class="clause-title">CLÁUSULA 5ª — DAS OBRIGAÇÕES DA CONTRATADA</p>
  <p>A CONTRATADA obriga-se a executar os serviços contratados com diligência e técnica, manter o sigilo das informações da CONTRATANTE e comunicar qualquer irregularidade fiscal ou contábil detectada.</p>
</div>

<div class="clause">
  <p class="clause-title">CLÁUSULA 6ª — DO FORO</p>
  <p>As partes elegem o foro da comarca de ${dados.cliente.municipio}/${dados.cliente.uf} para dirimir quaisquer dúvidas oriundas deste contrato.</p>
</div>

${dados.obs ? `<div class="clause"><p class="clause-title">CLÁUSULA 7ª — DAS DISPOSIÇÕES GERAIS</p><p>${dados.obs}</p></div>` : ''}

<p>Por estarem de acordo, as partes assinam o presente instrumento em 2 (duas) vias de igual teor, na cidade de ${dados.cliente.municipio}, ${hoje}.</p>

<div class="assinaturas">
  <div class="assina">
    <p><strong>CONTRATANTE</strong></p>
    <p>${dados.cliente.razao}</p>
    <p>CNPJ: ${dados.cliente.cnpj}</p>
  </div>
  <div class="assina">
    <p><strong>CONTRATADA</strong></p>
    <p>Hexxa Contabilidade LTDA</p>
    <p>CNPJ: 00.000.000/0001-99</p>
  </div>
</div>

<div class="rodape">Gerado via Hexx Hub Digital · ${hoje}</div>
</body></html>`;
}

export default function AdminContratos({ clientes, planos, historicoInicial }: { clientes: ClienteOpcao[]; planos: PlanoOpcao[]; historicoInicial: ContratoGerado[] }) {
  const [clienteId, setClienteId] = useState('');
  const [plano, setPlano] = useState(planos[0]?.nome ?? '');
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [vigencia, setVigencia] = useState('12');
  const [servicos, setServicos] = useState<string[]>([
    'Escrituração contábil mensal',
    'Apuração de impostos (Simples Nacional)',
    'Emissão de guias de recolhimento (DAS, DARF, GPS)',
    'Elaboração e entrega de declarações fiscais (DEFIS, PGDAS)',
  ]);
  const [obs, setObs] = useState('');
  const [contratos, setContratos] = useState<Contrato[]>(historicoInicial);
  const [salvando, setSalvando] = useState(false);

  const clienteSel = clientes.find(c => c.id === clienteId);
  const planoSel = planos.find(p => p.nome === plano);

  function toggleServico(s: string) {
    setServicos(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  async function gerar(modo: 'print' | 'download') {
    if (!clienteSel || !planoSel || servicos.length === 0) return;
    const html = gerarContratoHTML({ cliente: clienteSel, plano, valor: planoSel.valor, inicio, vigencia, servicos, obs });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    if (modo === 'print') {
      setTimeout(() => w.print(), 500);
    }

    setSalvando(true);
    const res = await salvarContratoGeradoAction({
      companyId: clienteSel.id,
      plano,
      valor: planoSel.valor,
      inicio,
      vigenciaMeses: vigencia === '0' ? null : Number(vigencia),
      servicos,
      observacao: obs,
    });
    setSalvando(false);

    if (!('error' in res)) {
      setContratos(prev => [{
        id: Date.now().toString(),
        cliente: clienteSel.razao,
        plano,
        valor: planoSel.valor,
        inicio,
        geradoEm: new Date().toLocaleString('pt-BR'),
        status: 'ativo',
      }, ...prev]);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 animate-in fade-in">
      <div>
        <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight text-[#231F20] dark:text-[#FEFDF3]">Contratos</h1>
        <p className="text-xs sm:text-sm text-[#6E6A61] dark:text-[#A8A49C] mt-1">Gere contratos de prestação de serviço em PDF</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3 space-y-4 rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 sm:p-8 shadow-sm">
          <h2 className="font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Novo contrato</h2>

          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={`mt-1.5 ${fi}`}>
              <option value="">Selecionar cliente…</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.razao}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Plano</label>
              <select value={plano} onChange={e => setPlano(e.target.value)} className={`mt-1.5 ${fi}`}>
                {planos.map(p => <option key={p.nome} value={p.nome}>{p.nome} — {BRL.format(p.valor)}/mês</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Vigência</label>
              <select value={vigencia} onChange={e => setVigencia(e.target.value)} className={`mt-1.5 ${fi}`}>
                <option value="12">12 meses</option>
                <option value="6">6 meses</option>
                <option value="0">Indeterminado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Data de início</label>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={`mt-1.5 ${fi}`} />
          </div>

          {/* Serviços */}
          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider mb-2 block">Serviços incluídos *</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {SERVICOS_OPCOES.map(s => (
                <label key={s} className="flex cursor-pointer items-start gap-2.5 rounded-2xl p-2 hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                  <input type="checkbox" checked={servicos.includes(s)} onChange={() => toggleServico(s)}
                    className="mt-0.5 h-4 w-4 rounded accent-[#1E3328] shrink-0" />
                  <span className="text-xs sm:text-sm text-[#231F20] dark:text-[#FEFDF3]">{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-[#6E6A61] dark:text-[#A8A49C] uppercase tracking-wider">Cláusula adicional (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Ex.: Os serviços de folha de pagamento serão cobrados separadamente…"
              className={`mt-1.5 ${fi} resize-none`} />
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={() => gerar('print')} disabled={!clienteId || servicos.length === 0 || salvando}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-[#1E3328] hover:bg-[#2F4A3C] py-3 text-xs font-bold text-[#DFFFAE] disabled:opacity-50 transition-all shadow-xs">
              <Eye className="h-4 w-4" /> Visualizar / Imprimir
            </button>
            <button onClick={() => gerar('download')} disabled={!clienteId || servicos.length === 0 || salvando}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/10 bg-white/80 dark:bg-white/10 px-4 py-3 text-xs font-bold text-[#6E6A61] hover:bg-black/5 disabled:opacity-50 dark:text-[#A8A49C] dark:hover:bg-white/5 transition-colors">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Histórico */}
        <div className="lg:col-span-2 rounded-3xl border border-black/5 dark:border-white/10 bg-[#F4EFE4]/60 dark:bg-[#1A201C]/60 backdrop-blur-md p-6 shadow-sm">
          <h2 className="mb-4 font-serif font-bold text-base text-[#231F20] dark:text-[#FEFDF3]">Contratos gerados</h2>
          {contratos.length === 0 ? (
            <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C] text-center py-8">Nenhum contrato gerado ainda.</p>
          ) : (
            <div className="space-y-3">
              {contratos.map(c => (
                <div key={c.id} className="rounded-2xl bg-[#FEFDF3] dark:bg-[#121614] border border-black/5 dark:border-white/10 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[#231F20] dark:text-[#FEFDF3] truncate">{c.cliente}</p>
                      <p className="text-xs text-[#6E6A61] dark:text-[#A8A49C]">{c.plano} · {BRL.format(c.valor)}/mês</p>
                      <p className="text-[11px] text-[#6E6A61] dark:text-[#A8A49C]">Início: {c.inicio.split('-').reverse().join('/')}</p>
                      <p className="text-[10px] text-[#6E6A61] dark:text-[#A8A49C] mt-0.5">{c.geradoEm}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                      c.status === 'ativo' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-black/5 text-[#6E6A61] dark:bg-white/10 dark:text-[#A8A49C]'
                    }`}>
                      {c.status === 'ativo' ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {c.status === 'ativo' ? 'Ativo' : 'Cancelado'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

