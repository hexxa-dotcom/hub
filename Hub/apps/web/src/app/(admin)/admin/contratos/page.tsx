'use client';

import { useState } from 'react';
import { FileSignature, Download, Eye, Plus, CheckCircle2, Clock } from 'lucide-react';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CLIENTES = [
  { id: '1', razao: 'Hexxa Demo Serviços LTDA', cnpj: '00.000.000/0001-00', responsavel: 'Carlos Mendes', email: 'demo@hexxa.com.br', municipio: 'Joinville', uf: 'SC' },
  { id: '2', razao: 'Tech Soluções ME', cnpj: '11.111.111/0001-11', responsavel: 'Ana Beatriz Lima', email: 'contato@techsol.com.br', municipio: 'Florianópolis', uf: 'SC' },
  { id: '3', razao: 'Consultoria Silva & Cia', cnpj: '22.222.222/0001-22', responsavel: 'Roberto Silva', email: 'silva@silvaconsult.com.br', municipio: 'Porto Alegre', uf: 'RS' },
  { id: '4', razao: 'Studio Criativo LTDA', cnpj: '33.333.333/0001-33', responsavel: 'Julia Castro', email: 'hello@studiocriativo.com', municipio: 'São Paulo', uf: 'SP' },
  { id: '5', razao: 'Advocacia Mendes Associados', cnpj: '44.444.444/0001-44', responsavel: 'Diego Mendes', email: 'adv@mendesassociados.com.br', municipio: 'Curitiba', uf: 'PR' },
  { id: '6', razao: 'DEF Comércio e Serviços ME', cnpj: '55.555.555/0001-55', responsavel: 'Fernanda Oliveira', email: 'def@defservicos.com.br', municipio: 'Goiânia', uf: 'GO' },
];

const PLANOS = [
  { nome: 'Início', valor: 149.90 },
  { nome: 'Crescimento', valor: 299.90 },
  { nome: 'Escala', valor: 499.90 },
];

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

const HISTORICO: Contrato[] = [
  { id: 'c1', cliente: 'Hexxa Demo Serviços LTDA', plano: 'Início', valor: 149.90, inicio: '2024-01-15', geradoEm: '2024-01-14 10:00', status: 'ativo' },
  { id: 'c2', cliente: 'Tech Soluções ME', plano: 'Crescimento', valor: 299.90, inicio: '2024-03-01', geradoEm: '2024-02-28 09:30', status: 'ativo' },
  { id: 'c3', cliente: 'Consultoria Silva & Cia', plano: 'Início', valor: 149.90, inicio: '2024-06-10', geradoEm: '2024-06-09 14:00', status: 'ativo' },
];

const fi = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';

function gerarContratoHTML(dados: {
  cliente: typeof CLIENTES[0]; plano: string; valor: number;
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

export default function AdminContratos() {
  const [clienteId, setClienteId] = useState('');
  const [plano, setPlano] = useState('Início');
  const [inicio, setInicio] = useState(new Date().toISOString().slice(0, 10));
  const [vigencia, setVigencia] = useState('12');
  const [servicos, setServicos] = useState<string[]>([
    'Escrituração contábil mensal',
    'Apuração de impostos (Simples Nacional)',
    'Emissão de guias de recolhimento (DAS, DARF, GPS)',
    'Elaboração e entrega de declarações fiscais (DEFIS, PGDAS)',
  ]);
  const [obs, setObs] = useState('');
  const [contratos, setContratos] = useState(HISTORICO);

  const clienteSel = CLIENTES.find(c => c.id === clienteId);
  const planoSel = PLANOS.find(p => p.nome === plano)!;

  function toggleServico(s: string) {
    setServicos(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }

  function gerar(modo: 'print' | 'download') {
    if (!clienteSel || servicos.length === 0) return;
    const html = gerarContratoHTML({ cliente: clienteSel, plano, valor: planoSel.valor, inicio, vigencia, servicos, obs });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    if (modo === 'print') {
      setTimeout(() => w.print(), 500);
    }
    // Salva no histórico
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

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Contratos</h1>
        <p className="text-sm text-slate-500">Gere contratos de prestação de serviço em PDF</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Form */}
        <div className="lg:col-span-3 space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="font-semibold text-slate-900 dark:text-white">Novo contrato</h2>

          <div>
            <label className="text-xs font-medium text-slate-500">Cliente *</label>
            <select value={clienteId} onChange={e => setClienteId(e.target.value)} className={`mt-1 ${fi}`}>
              <option value="">Selecionar cliente…</option>
              {CLIENTES.map(c => <option key={c.id} value={c.id}>{c.razao}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500">Plano</label>
              <select value={plano} onChange={e => setPlano(e.target.value)} className={`mt-1 ${fi}`}>
                {PLANOS.map(p => <option key={p.nome} value={p.nome}>{p.nome} — {BRL.format(p.valor)}/mês</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Vigência</label>
              <select value={vigencia} onChange={e => setVigencia(e.target.value)} className={`mt-1 ${fi}`}>
                <option value="12">12 meses</option>
                <option value="6">6 meses</option>
                <option value="0">Indeterminado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Data de início</label>
            <input type="date" value={inicio} onChange={e => setInicio(e.target.value)} className={`mt-1 ${fi}`} />
          </div>

          {/* Serviços */}
          <div>
            <label className="text-xs font-medium text-slate-500 mb-2 block">Serviços incluídos *</label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {SERVICOS_OPCOES.map(s => (
                <label key={s} className="flex cursor-pointer items-start gap-2.5 rounded-xl p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  <input type="checkbox" checked={servicos.includes(s)} onChange={() => toggleServico(s)}
                    className="mt-0.5 h-4 w-4 rounded accent-brand-500 shrink-0" />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{s}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500">Cláusula adicional (opcional)</label>
            <textarea value={obs} onChange={e => setObs(e.target.value)} rows={2}
              placeholder="Ex.: Os serviços de folha de pagamento serão cobrados separadamente…"
              className={`mt-1 ${fi} resize-none`} />
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={() => gerar('print')} disabled={!clienteId || servicos.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50 transition-colors">
              <Eye className="h-4 w-4" /> Visualizar / Imprimir
            </button>
            <button onClick={() => gerar('download')} disabled={!clienteId || servicos.length === 0}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-400 transition-colors">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Histórico */}
        <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-4 font-semibold text-slate-900 dark:text-white">Contratos gerados</h2>
          {contratos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Nenhum contrato gerado ainda.</p>
          ) : (
            <div className="space-y-3">
              {contratos.map(c => (
                <div key={c.id} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{c.cliente}</p>
                      <p className="text-xs text-slate-400">{c.plano} · {BRL.format(c.valor)}/mês</p>
                      <p className="text-xs text-slate-400">Início: {c.inicio.split('-').reverse().join('/')}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{c.geradoEm}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      c.status === 'ativo' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-slate-100 text-slate-500'
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
