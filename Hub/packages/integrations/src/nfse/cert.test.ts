import { describe, it, expect } from 'vitest';
import forge from 'node-forge';
import { loadCertFromBase64, buildMtlsAgent } from './cert';

function makeSelfSignedPfx(password: string) {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [{ name: 'commonName', value: 'Empresa Teste LTDA:12345678000199' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: '3des',
  });
  const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
  return forge.util.encode64(p12Der);
}

describe('loadCertFromBase64 / buildMtlsAgent', () => {
  it('extrai chave privada e certificado de um .pfx válido', () => {
    const pfxB64 = makeSelfSignedPfx('senha123');
    const cert = loadCertFromBase64(pfxB64, 'senha123');

    expect(cert.keyPem).toContain('PRIVATE KEY');
    expect(cert.certPem).toContain('CERTIFICATE');
    expect(cert.password).toBe('senha123');
  });

  it('lança erro claro quando a senha está incorreta', () => {
    const pfxB64 = makeSelfSignedPfx('senha-certa');
    expect(() => loadCertFromBase64(pfxB64, 'senha-errada')).toThrow();
  });

  it('buildMtlsAgent concatena folha+cadeia em `cert` e mantém rejectUnauthorized true', () => {
    const pfxB64 = makeSelfSignedPfx('senha123');
    const cert = loadCertFromBase64(pfxB64, 'senha123');
    const agent = buildMtlsAgent(cert);
    const opts = (agent as unknown as { options: { cert: string; rejectUnauthorized?: boolean } }).options;

    expect(opts.cert).toContain(cert.certPem.trim());
    expect(opts.rejectUnauthorized).toBe(true);
  });
});
