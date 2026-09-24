import 'server-only';
import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import type { Proposta } from '@/lib/server/propostas';

/** A proposta em PDF: a marca da empresa, os itens, o total e as condições. */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const br = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/');
const s = StyleSheet.create({
  page: { padding: 56, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a', lineHeight: 1.5 },
  topo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 },
  marca: { flexDirection: 'row', alignItems: 'center' },
  logo: { width: 40, height: 40, marginRight: 12, objectFit: 'contain' },
  inicial: { width: 40, height: 40, marginRight: 12, borderRadius: 8, backgroundColor: '#0C110E', color: '#D4FF00', fontSize: 18, textAlign: 'center', paddingTop: 9 },
  empresa: { fontFamily: 'Helvetica-Bold', fontSize: 12 },
  cinza: { color: '#777', fontSize: 9 },
  titulo: { fontSize: 20, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  rotulo: { fontSize: 8, color: '#888', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 },
  linha: { flexDirection: 'row', borderBottomWidth: 0.6, borderBottomColor: '#e2e2e2', paddingVertical: 8 },
  total: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  rodape: { position: 'absolute', bottom: 32, left: 56, right: 56, fontSize: 8, color: '#999', textAlign: 'center' },
});

export async function renderPropostaPdf(
  p: Proposta,
  empresa: { nome: string; legal_name: string; cnpj: string; logo_url: string | null; email: string | null; phone: string | null; city: string | null; state: string | null },
  link: string | null,
): Promise<Buffer> {
  const doc = (
    <Document title={`Proposta ${p.numero}`}>
      <Page size="A4" style={s.page}>
        <View style={s.topo}>
          <View style={s.marca}>
            {empresa.logo_url ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={empresa.logo_url} style={s.logo} />
            ) : (
              <Text style={s.inicial}>{empresa.nome.trim()[0]?.toUpperCase()}</Text>
            )}
            <View>
              <Text style={s.empresa}>{empresa.nome}</Text>
              <Text style={s.cinza}>
                {empresa.legal_name} · CNPJ {empresa.cnpj}
              </Text>
              <Text style={s.cinza}>{[empresa.email, empresa.phone, empresa.city && `${empresa.city}/${empresa.state ?? ''}`].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.rotulo}>Proposta</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold' }}>{p.numero}</Text>
            <Text style={s.cinza}>Válida até {br(p.validade)}</Text>
          </View>
        </View>

        <Text style={s.rotulo}>Para</Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', marginBottom: 20 }}>{p.cliente.nome}</Text>

        <Text style={s.titulo}>{p.titulo}</Text>
        {p.observacoes && <Text style={{ color: '#444', marginBottom: 16 }}>{p.observacoes}</Text>}

        <View style={{ marginTop: 12 }}>
          <View style={[s.linha, { borderBottomColor: '#bbb' }]}>
            <Text style={[s.rotulo, { flex: 1, marginBottom: 0 }]}>Item</Text>
            <Text style={[s.rotulo, { width: 50, textAlign: 'right', marginBottom: 0 }]}>Qtd</Text>
            <Text style={[s.rotulo, { width: 90, textAlign: 'right', marginBottom: 0 }]}>Valor</Text>
            <Text style={[s.rotulo, { width: 90, textAlign: 'right', marginBottom: 0 }]}>Subtotal</Text>
          </View>
          {p.itens.map((i, k) => (
            <View key={k} style={s.linha}>
              <Text style={{ flex: 1 }}>{i.descricao}</Text>
              <Text style={{ width: 50, textAlign: 'right' }}>{i.qtd.toLocaleString('pt-BR')}</Text>
              <Text style={{ width: 90, textAlign: 'right' }}>{BRL.format(i.valor)}</Text>
              <Text style={{ width: 90, textAlign: 'right' }}>{BRL.format(i.qtd * i.valor)}</Text>
            </View>
          ))}
          <View style={s.total}>
            <Text style={{ fontSize: 9, color: '#666', marginRight: 12, marginTop: 4 }}>{p.recorrencia === 'MENSAL' ? 'Total por mês' : 'Total'}</Text>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 14 }}>{BRL.format(p.total)}</Text>
          </View>
          {p.recorrencia === 'MENSAL' && (
            <Text style={[s.cinza, { textAlign: 'right', marginTop: 2 }]}>
              Pagamento mensal{p.prazoMeses ? ` por ${p.prazoMeses} meses` : ''}.
            </Text>
          )}
        </View>

        {link && (
          <View style={{ marginTop: 36, padding: 14, borderWidth: 0.8, borderColor: '#d8d8d8', borderRadius: 6 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10 }}>Para aceitar esta proposta</Text>
            <Text style={[s.cinza, { marginTop: 3 }]}>Acesse {link.replace(/^https?:\/\//, '')} e clique em Aceitar.</Text>
          </View>
        )}

        <Text style={s.rodape}>Proposta gerada pela Hexx Digital · {empresa.nome}</Text>
      </Page>
    </Document>
  );
  return renderToBuffer(doc);
}
