import forge from 'node-forge';
import https from 'node:https';

/**
 * Certificado digital A1 (ICP-Brasil) — material extraído do .pfx/.p12.
 * Usado para (1) assinar o XML da DPS (XMLDSig) e (2) o handshake mTLS com a
 * API do Emissor Nacional. Roda SOMENTE no servidor; nunca exponha no client.
 */
export interface CertMaterial {
  /** Chave privada em PEM (para a assinatura XMLDSig). */
  keyPem: string;
  /** Certificado (folha) em PEM. */
  certPem: string;
  /** Cadeia de certificados (CA). */
  caPems: string[];
  /** O .pfx bruto (para o https.Agent no mTLS). */
  pfx: Buffer;
  /** Senha do .pfx. */
  password: string;
}

/** Abre o .pfx (base64) com a senha e extrai chave/certificado em PEM. */
export function loadCertFromBase64(pfxBase64: string, password: string): CertMaterial {
  const SHROUDED = forge.pki.oids.pkcs8ShroudedKeyBag as string;
  const KEYBAG = forge.pki.oids.keyBag as string;
  const CERTBAG = forge.pki.oids.certBag as string;

  const der = forge.util.decode64(pfxBase64);
  const asn1 = forge.asn1.fromDer(der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);

  // Chave privada (pode vir em bag cifrada ou simples).
  const shrouded = p12.getBags({ bagType: SHROUDED });
  const plain = p12.getBags({ bagType: KEYBAG });
  const keyBag = shrouded[SHROUDED]?.[0] ?? plain[KEYBAG]?.[0];
  if (!keyBag?.key) throw new Error('Certificado A1: chave privada não encontrada (senha incorreta?).');
  const keyPem = forge.pki.privateKeyToPem(keyBag.key);

  // Certificados (Folha + Cadeia).
  const certBags = p12.getBags({ bagType: CERTBAG });
  const allCertBags = certBags[CERTBAG] || [];
  if (allCertBags.length === 0 || !allCertBags[0]?.cert) throw new Error('Certificado A1: certificado não encontrado no arquivo.');
  
  // O primeiro costuma ser a folha, os demais são a cadeia.
  const certPem = forge.pki.certificateToPem(allCertBags[0]!.cert!);
  const caPems = allCertBags.slice(1).filter(c => !!c.cert).map(c => forge.pki.certificateToPem(c.cert!));

  return { keyPem, certPem, caPems, pfx: Buffer.from(pfxBase64, 'base64'), password };
}

/** Agente HTTPS com o certificado de cliente para o mTLS exigido pela API. */
export function buildMtlsAgent(cert: CertMaterial): https.Agent {
  return new https.Agent({ key: cert.keyPem, cert: cert.certPem, ca: cert.caPems, keepAlive: true, rejectUnauthorized: false });
}
