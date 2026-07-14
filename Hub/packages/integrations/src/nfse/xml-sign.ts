import { SignedXml } from 'xml-crypto';

/**
 * Assinatura digital XMLDSig (RSA-SHA256, enveloped) do XML da DPS, conforme
 * o Padrão Nacional NFS-e (NT 004/2021).
 * - Canonicalização: Exclusive C14N (exc-c14n#)
 * - Transforms: enveloped-signature + exc-c14n#
 * - Digest: SHA-256
 * - Assinatura: RSA-SHA256
 */
export function signDps(xml: string, refId: string, keyPem: string, certPem: string): string {
  const EXC_C14N = 'http://www.w3.org/2001/10/xml-exc-c14n#';

  const sig = new SignedXml({
    privateKey: keyPem,
    publicCert: certPem,
    signatureAlgorithm: 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256',
    canonicalizationAlgorithm: EXC_C14N,
  });

  sig.addReference({
    xpath: `//*[local-name(.)='infDPS' and @Id='${refId}']`,
    transforms: [
      'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
      EXC_C14N,
    ],
    digestAlgorithm: 'http://www.w3.org/2001/04/xmlenc#sha256',
    uri: `#${refId}`,
    isEmptyUri: false,
  });

  // Insere a <Signature> como irmã de <infDPS> dentro de <DPS>.
  sig.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='infDPS']`, action: 'after' },
  });

  return sig.getSignedXml();
}
