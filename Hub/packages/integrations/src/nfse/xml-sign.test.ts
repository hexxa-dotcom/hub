import { describe, it, expect, beforeAll } from 'vitest';
import forge from 'node-forge';
import { SignedXml } from 'xml-crypto';
import { signXmlElement } from './xml-sign';

let keyPem: string;
let certPem: string;

beforeAll(() => {
  // Certificado autoassinado só para o teste conseguir assinar/verificar —
  // não representa um certificado ICP-Brasil real.
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  const attrs = [{ name: 'commonName', value: 'Teste Hexxa Hub' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  keyPem = forge.pki.privateKeyToPem(keys.privateKey);
  certPem = forge.pki.certificateToPem(cert);
});

const sampleXml = (id: string, tag: string) =>
  `<?xml version="1.0" encoding="UTF-8"?><Root xmlns="urn:test"><${tag} Id="${id}"><valor>123</valor></${tag}></Root>`;

describe('signXmlElement', () => {
  it('assina o elemento infDPS e produz uma assinatura verificável', () => {
    const refId = 'DPS0000000000000000000000000000000000000000000001';
    const xml = sampleXml(refId, 'infDPS');
    const signed = signXmlElement(xml, refId, keyPem, certPem, 'infDPS');

    expect(signed).toContain('<Signature');
    expect(signed).toContain(`URI="#${refId}"`);

    const verifier = new SignedXml();
    verifier.publicCert = certPem;
    verifier.loadSignature(signed.match(/<Signature[\s\S]*<\/Signature>/)![0]);
    const isValid = verifier.checkSignature(signed);
    expect(isValid).toBe(true);
  });

  it('assina o elemento infPedReg (evento de cancelamento) de forma independente do infDPS', () => {
    const refId = 'PRE' + '0'.repeat(50) + '101101';
    const xml = sampleXml(refId, 'infPedReg');
    const signed = signXmlElement(xml, refId, keyPem, certPem, 'infPedReg');

    expect(signed).toContain('<Signature');
    expect(signed).toContain(`URI="#${refId}"`);

    const verifier = new SignedXml();
    verifier.publicCert = certPem;
    verifier.loadSignature(signed.match(/<Signature[\s\S]*<\/Signature>/)![0]);
    const isValid = verifier.checkSignature(signed);
    expect(isValid).toBe(true);
  });

  it('a assinatura fica inválida se o XML for adulterado após assinado', () => {
    const refId = 'DPS0000000000000000000000000000000000000000000001';
    const xml = sampleXml(refId, 'infDPS');
    const signed = signXmlElement(xml, refId, keyPem, certPem, 'infDPS');
    const tampered = signed.replace('<valor>123</valor>', '<valor>999</valor>');

    const verifier = new SignedXml();
    verifier.publicCert = certPem;
    verifier.loadSignature(tampered.match(/<Signature[\s\S]*<\/Signature>/)![0]);
    const isValid = verifier.checkSignature(tampered);
    expect(isValid).toBe(false);
  });
});
