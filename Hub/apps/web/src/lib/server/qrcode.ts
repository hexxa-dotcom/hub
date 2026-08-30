import 'server-only';
import QRCode from 'qrcode';

const NFSE_PORTAL_CONSULTA = 'https://www.nfse.gov.br/consultapublica';

/**
 * QR Code de verificação de autenticidade da NFS-e. Aponta pro portal
 * público oficial de consulta, com a chave de acesso como parâmetro.
 *
 * O governo NÃO documenta publicamente o formato exato usado no QR dos
 * DANFSe oficiais (é gerado internamente pelo backend deles, com um token
 * assinado, não a chave em texto puro) — por isso não temos certeza se
 * `?chave=` pré-preenche a busca automaticamente. Na pior hipótese (o
 * parâmetro é ignorado), o QR ainda cai na página oficial de busca, nunca
 * num link quebrado — e a chave de acesso já vai impressa por extenso no
 * documento pra digitação manual, então a verificação nunca fica bloqueada
 * por essa incerteza.
 */
export async function generateNfseQrCode(chaveAcesso: string): Promise<string> {
  const url = `${NFSE_PORTAL_CONSULTA}?chave=${encodeURIComponent(chaveAcesso)}`;
  return QRCode.toDataURL(url, { margin: 1, width: 240, errorCorrectionLevel: 'M' });
}
