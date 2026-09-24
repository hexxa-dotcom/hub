/**
 * Os contatos da empresa, prontos para virar botão: rótulo, o que se lê e o
 * link. Usado no cartão público e na Minha Empresa — um lugar só decide como
 * um @ do Instagram ou um número de WhatsApp vira endereço.
 *
 * Todo link sai como http(s), mailto ou tel: o que a empresa digitou nunca
 * vira `javascript:` ou outro esquema.
 */

export type TipoDeContato = 'whatsapp' | 'instagram' | 'site' | 'linkedin' | 'email' | 'telefone';

export interface Contato {
  tipo: TipoDeContato;
  rotulo: string;
  valor: string;
  href: string;
}

export function formatarTelefone(phone: string | null): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return phone;
}

export function formatarCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, '');
  return d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : cnpj;
}

const web = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, '')}`);
const semProtocolo = (v: string) => v.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');

export function contatosDaEmpresa(f: {
  whatsapp: string | null;
  instagram: string | null;
  website: string | null;
  linkedin: string | null;
  email: string | null;
  telefone: string | null;
}): Contato[] {
  const lista: Contato[] = [];
  const zap = f.whatsapp?.replace(/\D/g, '');
  if (zap && zap.length >= 10) {
    lista.push({ tipo: 'whatsapp', rotulo: 'WhatsApp', valor: formatarTelefone(zap), href: `https://wa.me/55${zap.replace(/^55(?=\d{10,11}$)/, '')}` });
  }
  if (f.instagram?.trim()) {
    const usuario = f.instagram.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/[/?].*$/, '');
    if (usuario) lista.push({ tipo: 'instagram', rotulo: 'Instagram', valor: `@${usuario}`, href: `https://instagram.com/${encodeURIComponent(usuario)}` });
  }
  if (f.website?.trim()) lista.push({ tipo: 'site', rotulo: 'Site', valor: semProtocolo(f.website.trim()), href: web(f.website.trim()) });
  if (f.linkedin?.trim()) {
    const v = f.linkedin.trim();
    lista.push({ tipo: 'linkedin', rotulo: 'LinkedIn', valor: semProtocolo(v).replace(/^linkedin\.com\//i, ''), href: web(v) });
  }
  if (f.email?.trim()) lista.push({ tipo: 'email', rotulo: 'E-mail', valor: f.email.trim(), href: `mailto:${f.email.trim()}` });
  const tel = f.telefone?.replace(/\D/g, '');
  if (tel && tel.length >= 10) lista.push({ tipo: 'telefone', rotulo: 'Telefone', valor: formatarTelefone(tel), href: `tel:+55${tel.replace(/^55(?=\d{10,11}$)/, '')}` });
  return lista;
}
