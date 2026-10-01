type GuiaDisponivel = {id:string;installmentGroupId?:string|null;fileUrl?:string|null;status:string};
type EntregaDaGuia = {taxGuideId:string|null;temArquivo:boolean;visualizadoEm:string|null;confirmadoEm:string|null};

/** Uma previsão não é uma nova guia. O aviso dura até abrir/baixar ou confirmar a entrega. */
export function novasGuiasParcelamento(guias:GuiaDisponivel[],entregas:EntregaDaGuia[]):string[] {
 const novas=new Set(entregas.filter(e=>e.taxGuideId && e.temArquivo && !e.visualizadoEm && !e.confirmadoEm).map(e=>e.taxGuideId));
 return [...new Set(guias.filter(g=>g.installmentGroupId && g.fileUrl && g.status!=='PAID' && novas.has(g.id)).map(g=>g.id))];
}
