import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { MODELOS, clausulasDoContrato, type DadosDoContrato } from './modelos';

/** O PDF do contrato, a partir de um modelo (ver `modelos.ts`). */

const s = StyleSheet.create({
  page: { paddingTop: 56, paddingBottom: 64, paddingHorizontal: 60, fontFamily: 'Helvetica', fontSize: 10.5, lineHeight: 1.55, color: '#1a1a1a' },
  titulo: { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 22, letterSpacing: 1, textTransform: 'uppercase' },
  secao: { fontSize: 10.5, fontFamily: 'Helvetica-Bold', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  paragrafo: { marginBottom: 6, textAlign: 'justify' },
  negrito: { fontFamily: 'Helvetica-Bold' },
  bloco: { width: '45%', borderTopWidth: 0.8, borderTopColor: '#000', paddingTop: 6, textAlign: 'center', fontSize: 9.5 },
  rodape: { position: 'absolute', bottom: 28, left: 60, right: 60, fontSize: 8, color: '#888', textAlign: 'center' },
});

// Linha de assinatura de cada parte na última página, em pontos (A4 = 595 × 842).
const LINHA_CONTRATANTE = 260;
const LINHA_CONTRATADA = 460;
const A4 = { w: 595, h: 842 };
const areaAcima = (linha: number) => ({ x: 60 / A4.w, y: (linha - 62) / A4.h, w: 300 / A4.w, h: 58 / A4.h, page: 'last' as const });
/** Onde o campo de assinatura de cada parte fica no PDF, para o DocuSeal. */
export const AREAS_DE_ASSINATURA = { CONTRATANTE: areaAcima(LINHA_CONTRATANTE), CONTRATADA: areaAcima(LINHA_CONTRATADA) };

export function ContratoPdf({ dados }: { dados: DadosDoContrato }) {
  const clausulas = clausulasDoContrato(dados);
  const parte = (p: DadosDoContrato['contratante'], papel: string) => (
    <Text style={s.paragrafo}>
      <Text style={s.negrito}>{p.nome}</Text>, inscrita no CPF/CNPJ sob o nº <Text style={s.negrito}>{p.documento || 'não informado'}</Text>
      {p.endereco ? `, com endereço em ${p.endereco}` : ''}, doravante denominada <Text style={s.negrito}>{papel}</Text>.
    </Text>
  );

  return (
    <Document title={MODELOS[dados.modelo].titulo}>
      <Page size="A4" style={s.page}>
        <Text style={s.titulo}>{MODELOS[dados.modelo].titulo}</Text>

        <Text style={s.secao}>Das partes</Text>
        {parte(dados.contratante, 'CONTRATANTE')}
        {parte(dados.contratada, 'CONTRATADA')}
        <Text style={s.paragrafo}>As partes acima têm, entre si, justo e acertado o presente contrato, que se regerá pelas cláusulas seguintes.</Text>

        {clausulas.map((c, i) => (
          <View key={c.titulo} wrap>
            <Text style={s.secao}>
              Cláusula {i + 1}ª — {c.titulo}
            </Text>
            {c.itens.map((item, j) => (
              <Text key={j} style={s.paragrafo}>
                <Text style={s.negrito}>
                  {i + 1}.{j + 1}.
                </Text>{' '}
                {item}
              </Text>
            ))}
          </View>
        ))}

        <Text style={[s.paragrafo, { marginTop: 18, textAlign: 'center' }]}>{dados.cidadeData}</Text>

        <Text style={s.rodape} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
      </Page>

      {/* Página só das assinaturas, com posições fixas: é onde o DocuSeal põe
          o campo de cada parte (ver AREAS_DE_ASSINATURA). */}
      <Page size="A4" style={s.page}>
        <Text style={s.titulo}>Assinaturas</Text>
        <Text style={[s.paragrafo, { textAlign: 'center', color: '#555' }]}>
          {MODELOS[dados.modelo].titulo} entre {dados.contratante.nome} e {dados.contratada.nome}.
        </Text>
        {([
          ['CONTRATANTE', dados.contratante, LINHA_CONTRATANTE],
          ['CONTRATADA', dados.contratada, LINHA_CONTRATADA],
        ] as const).map(([papel, p, topo]) => (
          <View key={papel} style={[s.bloco, { position: 'absolute', top: topo, left: 60, width: 300, textAlign: 'left' }]}>
            <Text style={s.negrito}>{p.nome}</Text>
            <Text>
              {papel} · {p.documento}
            </Text>
          </View>
        ))}
        <Text style={s.rodape}>Assinado eletronicamente — MP 2.200-2/2001, art. 10, § 2º, e Lei 14.063/2020.</Text>
      </Page>
    </Document>
  );
}
