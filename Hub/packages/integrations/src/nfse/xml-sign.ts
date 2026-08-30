import { SignedXml } from 'xml-crypto';

/**
 * Assinatura digital XMLDSig (RSA-SHA256, enveloped) de um XML do Padrão
 * Nacional NFS-e (NT 004/2021) — usada tanto para a DPS quanto para o
 * pedRegEvento (ex: cancelamento).
 * - Canonicalização: Exclusive C14N (exc-c14n#)
 * - Transforms: enveloped-signature + exc-c14n#
 * - Digest: SHA-256
 * - Assinatura: RSA-SHA256
 *
 * @param signedElementLocalName nome do elemento que carrega o Id assinado
 *   (ex: "infDPS", "infPedReg") — a <Signature> é inserida como sua irmã.
 */
export function signXmlElement(
  xml: string,
  refId: string,
  keyPem: string,
  certPem: string,
  signedElementLocalName: string,
): string {
  const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';

  const sig = new SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: EXC_C14N,
  });

  sig.addReference({
    xpath: `//*[local-name(.)='${signedElementLocalName}' and @Id='${refId}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      EXC_C14N,
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    uri: `#${refId}`,
    isEmptyUri: false,
  });

  // Insere a <Signature> como irmã do elemento assinado.
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${signedElementLocalName}']`, action: 'after' },
  });

  return sig.getSignedXml();
}

/** Assina o XML da DPS (mantido por compatibilidade — delega ao genérico). */
export function signDps(xml: string, refId: string, keyPem: string, certPem: string): string {
  return signXmlElement(xml, refId, keyPem, certPem, 'infDPS');
}
