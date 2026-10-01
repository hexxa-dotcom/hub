export type RegraRecibo = {
  companyType: string;
  source: string;
  type: string;
  status: string;
  paidAt: string | null;
  amount: number;
  ownerType?: string | null;
};

/** Recibos de comprovação não criam recebíveis nem uma segunda receita. */
export function validarRecibo(r: RegraRecibo): string | null {
  if (r.type !== 'RECEIVABLE') return 'Emita o recibo a partir de um recebimento.';
  if (r.status !== 'PAID' || !r.paidAt) return 'Registre o pagamento e sua data antes de emitir o recibo de quitação.';
  if (!Number.isFinite(r.amount) || r.amount <= 0) return 'O valor recebido deve ser maior que zero.';
  return null;
}

export function reciboPodeApurar(r: RegraRecibo): boolean {
  return validarRecibo(r) === null && r.companyType === 'HOLDING' && r.source === 'RENT' && r.ownerType === 'PJ';
}

export function dataReciboValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === iso;
}

export function proximaDataRecibo(iso: string, dia: number): string {
  const [ano, mes] = iso.split('-').map(Number);
  const ultimo = new Date(Date.UTC(ano!, mes! + 1, 0)).getUTCDate();
  return new Date(Date.UTC(ano!, mes!, Math.min(dia, ultimo), 12)).toISOString().slice(0, 10);
}

export interface ReciboItem { descricao: string; valor: number; desconto?: boolean; despesaId?: string }
export function validarDiscriminacao(items: ReciboItem[], total: number): ReciboItem[] {
  if (!Array.isArray(items) || !items.length || items.length > 8) throw new Error('Informe entre 1 e 8 itens.');
  const clean = items.map(i => {
    if (typeof i.descricao !== 'string' || !i.descricao.trim() || i.descricao.length > 90 || typeof i.valor !== 'number' || !Number.isFinite(i.valor) || i.valor <= 0 || Math.abs(i.valor * 100 - Math.round(i.valor * 100)) > 0.0001) throw new Error('Cada item precisa de descrição (até 90 caracteres) e valor positivo com até dois decimais.');
    if (i.despesaId && (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i.despesaId) || i.desconto)) throw new Error('Vínculo de despesa inválido.');
    return { descricao:i.descricao.trim(), valor:i.valor, desconto:!!i.desconto, ...(i.despesaId ? { despesaId:i.despesaId } : {}) };
  });
  if (clean.reduce((sum,i) => sum + Math.round(i.valor*100)*(i.desconto ? -1 : 1),0) !== Math.round(total*100)) throw new Error('A discriminação deve somar exatamente o valor recebido.');
  const ids=clean.filter(i=>i.despesaId).map(i=>i.despesaId);
  if (new Set(ids).size !== ids.length) throw new Error('Uma despesa não pode ser incluída duas vezes.');
  return clean;
}
export function itensDoRecebimento(r: {amount:unknown; interest?:unknown; discount?:unknown; description:string; receipt_items?:unknown}): ReciboItem[] {
  if (r.receipt_items) return validarDiscriminacao(r.receipt_items as ReciboItem[], Number(r.amount));
  const interest=Number(r.interest || 0), discount=Number(r.discount || 0);
  const base=Math.round((Number(r.amount)-interest+discount)*100)/100;
  return validarDiscriminacao([
    {descricao:r.description.slice(0,90),valor:base},
    ...(interest>0 ? [{descricao:'Juros e multas',valor:interest}] : []),
    ...(discount>0 ? [{descricao:'Desconto',valor:discount,desconto:true}] : []),
  ],Number(r.amount));
}
