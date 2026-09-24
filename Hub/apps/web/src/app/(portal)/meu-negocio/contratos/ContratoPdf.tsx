import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import type { Style } from '@react-pdf/types';
import { MODELOS, clausulasDoContrato, type DadosDoContrato } from './modelos';

/** O PDF do contrato, a partir de um modelo (ver `modelos.ts`). */

const s = StyleSheet.create({
  page: { paddingTop: 52, paddingBottom: 60, paddingHorizontal: 60, fontFamily: 'Helvetica', fontSize: 10, lineHeight: 1.5, color: '#1a1a1a' },
  titulo: { fontSize: 14, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 22, letterSpacing: 1, textTransform: 'uppercase' },
  secao: { fontSize: 10, fontFamily: 'Helvetica-Bold', marginTop: 10, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  paragrafo: { marginBottom: 5, textAlign: 'justify' },
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

/**
 * O selo de verificação: o código e o endereço onde qualquer pessoa confere
 * o contrato (/v/<código>). Vai no rodapé de todas as páginas e, com o QR
 * code, na página de assinaturas — faz parte do documento assinado, então
 * entra no hash.
 */
export interface Verificacao {
  codigo: string;
  url: string;
  /** QR code do endereço, em PNG (data URL). */
  qr: string;
}

export function ContratoPdf({
  dados,
  verificacao,
  paginaDeAssinaturas = false,
}: {
  dados: DadosDoContrato;
  verificacao?: Verificacao;
  /**
   * true: as assinaturas vão numa página só delas, em posições fixas — é o
   * que o DocuSeal precisa para pôr o campo de cada parte. false (assinatura
   * no Hub): vêm logo depois da última cláusula, sem página a mais.
   */
  paginaDeAssinaturas?: boolean;
}) {
  const clausulas = clausulasDoContrato(dados);
  const parte = (p: DadosDoContrato['contratante'], papel: string) => (
    <Text style={s.paragrafo}>
      <Text style={s.negrito}>{p.nome}</Text>, inscrita no CPF/CNPJ sob o nº <Text style={s.negrito}>{p.documento || 'não informado'}</Text>
      {p.endereco ? `, com endereço em ${p.endereco}` : ''}, doravante denominada <Text style={s.negrito}>{papel}</Text>.
    </Text>
  );

  const fechamento = (
    <>
      <Text style={s.paragrafo}>
        E, por estarem de acordo, {dados.contratante.nome} e {dados.contratada.nome} assinam eletronicamente este{' '}
        {MODELOS[dados.modelo].titulo.replace(/^Contrato/, 'contrato')}, com os mesmos efeitos da assinatura em papel.
      </Text>
      <Text style={[s.paragrafo, { marginTop: 6 }]}>{dados.cidadeData}</Text>
    </>
  );
  const selo = (estilo: Style) =>
    verificacao ? (
      <View style={[{ flexDirection: 'row', alignItems: 'center', borderWidth: 0.8, borderColor: '#cfcfcf', borderRadius: 6, padding: 12 }, estilo]}>
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image src={verificacao.qr} style={{ width: 64, height: 64, marginRight: 14 }} />
        <View style={{ flex: 1 }}>
          <Text style={[s.negrito, { fontSize: 9.5 }]}>Verificação de autenticidade</Text>
          <Text style={{ fontSize: 8.5, color: '#444', marginTop: 3 }}>
            Este contrato foi assinado eletronicamente pelo Hexxa Hub. Quem assinou, quando e de onde fica registrado, junto com o código (hash SHA-256) deste arquivo.
          </Text>
          <Text style={{ fontSize: 8.5, marginTop: 4 }}>
            Código <Text style={s.negrito}>{verificacao.codigo}</Text> · {verificacao.url}
          </Text>
        </View>
      </View>
    ) : null;

  return (
    <Document title={MODELOS[dados.modelo].titulo}>
      <Page size="A4" style={s.page}>
        {/* Rodapé em todas as páginas: o selo de verificação. Texto fixo — o
            `render` do react-pdf (para numerar páginas) some com o rodapé
            inteiro nesta versão (4.5). */}
        {verificacao && (
          <View style={s.rodape} fixed>
            <Text>
              Assinado eletronicamente pelo Hexxa Hub · código {verificacao.codigo} · confira em {verificacao.url}
            </Text>
          </View>
        )}
        <Text style={s.titulo}>{MODELOS[dados.modelo].titulo}</Text>

        <Text style={s.secao}>Das partes</Text>
        {parte(dados.contratante, 'CONTRATANTE')}
        {parte(dados.contratada, 'CONTRATADA')}
        <Text style={s.paragrafo}>As partes acima têm, entre si, justo e acertado o presente contrato, que se regerá pelas cláusulas seguintes.</Text>

        {clausulas.map((c, i) => (
          <View key={c.titulo} wrap>
            {/* O título não fica sozinho no pé da página, longe do texto dele. */}
            <Text style={s.secao} minPresenceAhead={60}>
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

        {/* Assinatura no Hub: fechamento, assinaturas e selo logo depois do
            texto, num bloco que não se parte — se não couber, vai inteiro
            para a página seguinte, sem deixar uma folha quase vazia. */}
        {!paginaDeAssinaturas && (
          <View wrap={false} style={{ marginTop: 16 }}>
            {fechamento}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 40 }}>
              {([
                ['CONTRATANTE', dados.contratante],
                ['CONTRATADA', dados.contratada],
              ] as const).map(([papel, p]) => (
                <View key={papel} style={[s.bloco, { textAlign: 'left' }]}>
                  <Text style={s.negrito}>{p.nome}</Text>
                  <Text>
                    {papel} · {p.documento}
                  </Text>
                </View>
              ))}
            </View>
            {selo({ marginTop: 20 })}
          </View>
        )}
      </Page>

      {paginaDeAssinaturas && (
        // Página só das assinaturas, com posições fixas: é onde o DocuSeal
        // põe o campo de cada parte (ver AREAS_DE_ASSINATURA).
      <Page size="A4" style={s.page}>
        <Text style={s.titulo}>Assinaturas</Text>
        {fechamento}
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
        {selo({ position: 'absolute', top: 600, left: 60, right: 60 })}
        <Text style={s.rodape}>
          Assinado eletronicamente — MP 2.200-2/2001, art. 10, § 2º{verificacao ? ` · código ${verificacao.codigo}` : ''}.
        </Text>
      </Page>
      )}
    </Document>
  );
}
