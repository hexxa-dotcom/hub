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

/**
 * Agente HTTPS com o certificado de cliente para o mTLS exigido pela API.
 *
 * `cert`/`key` carregam o certificado do CLIENTE (folha + cadeia intermediária,
 * concatenados em PEM) para a autenticação mútua. `ca` do https.Agent serve
 * para outro propósito — validar o certificado do SERVIDOR remoto — por isso
 * NÃO deve receber a cadeia do cliente; usamos o trust store padrão do Node
 * (que já contém as CAs públicas confiáveis usadas pelo gov.br) e mantemos
 * `rejectUnauthorized: true` para não abrir brecha de man-in-the-middle.
 */
export function buildMtlsAgent(cert: CertMaterial): https.Agent {
  const certChain = [cert.certPem, ...cert.caPems].join('\n');
  return new https.Agent({ key: cert.keyPem, cert: certChain, keepAlive: true, rejectUnauthorized: true });
}

/**
 * FICHA DO CERTIFICADO: quem é, e até quando vale.
 *
 * ── Por que isto existe ────────────────────────────────────────────────
 *
 * Um certificado A1 vale um ano e vence sem avisar. Quando vence, a emissão
 * de nota para de funcionar — e o cliente descobre no pior momento possível,
 * com a nota para emitir e o prazo correndo. O arquivo carrega a data de
 * validade dentro dele; não havia motivo para ninguém ler.
 *
 * Também confere o titular. Subir por engano o certificado de OUTRA empresa é
 * comum quando alguém cuida de mais de um CNPJ, e o erro só apareceria na
 * primeira emissão, como uma recusa incompreensível do Emissor Nacional.
 */
export interface FichaDoCertificado {
  /** Nome no certificado, como "FULANO LTDA:12345678000199". */
  titular: string;
  /** CNPJ extraído do titular, só dígitos — vazio quando não há. */
  cnpj: string;
  /** ISO (AAAA-MM-DD). */
  validoDe: string;
  validoAte: string;
  diasParaVencer: number;
  vencido: boolean;
}

export function inspecionarCertificado(
  pfxBase64: string,
  password: string,
  hoje = new Date(),
): FichaDoCertificado {
  const der = forge.util.decode64(pfxBase64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, password);
  const CERTBAG = forge.pki.oids.certBag as string;
  const cert = p12.getBags({ bagType: CERTBAG })[CERTBAG]?.[0]?.cert;
  if (!cert) throw new Error('Certificado A1: certificado não encontrado no arquivo.');

  const titular = cert.subject.getField('CN')?.value ?? '';
  // O padrão ICP-Brasil põe o CNPJ depois de ":" no CN do e-CNPJ.
  const cnpj = (String(titular).split(':')[1] ?? '').replace(/\D/g, '');

  const dia = (d: Date) => d.toISOString().slice(0, 10);
  const ate = cert.validity.notAfter;
  // Dias inteiros, pela data — comparar com hora faria "vence hoje" virar
  // "venceu" às 00h01 do próprio dia de validade.
  const umDia = 24 * 60 * 60 * 1000;
  const diasParaVencer = Math.floor(
    (Date.parse(dia(ate)) - Date.parse(dia(hoje))) / umDia,
  );

  return {
    titular: String(titular),
    cnpj,
    validoDe: dia(cert.validity.notBefore),
    validoAte: dia(ate),
    diasParaVencer,
    vencido: diasParaVencer < 0,
  };
}

export interface DadosDoECnpj extends FichaDoCertificado {
  /** Razão social: o CN antes do ":". */
  razaoSocial: string;
  /** Pessoa física responsável pelo e-CNPJ, como consta no certificado. */
  responsavelNome: string | null;
  /** CPF do responsável, só dígitos. */
  responsavelCpf: string | null;
}

/**
 * O QUE UM e-CNPJ DIZ SOBRE A EMPRESA E QUEM RESPONDE POR ELA.
 *
 * A norma ICP-Brasil (DOC-ICP-04) obriga o e-CNPJ a carregar, no
 * subjectAltName, campos "otherName" identificados por OID:
 *
 *   2.16.76.1.3.2 — nome do responsável pelo certificado
 *   2.16.76.1.3.3 — CNPJ da empresa
 *   2.16.76.1.3.4 — nascimento (8) + CPF (11) + NIS (11) + RG... do responsável
 *
 * É o que permite o cadastro começar pelo certificado: um arquivo e a senha
 * trazem CNPJ, razão social, responsável e CPF, sem nada digitado.
 */
export function lerDadosDoECnpj(pfxBase64: string, password: string, hoje = new Date()): DadosDoECnpj {
  const ficha = inspecionarCertificado(pfxBase64, password, hoje);
  const der = forge.util.decode64(pfxBase64);
  const p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(der), false, password);
  const CERTBAG = forge.pki.oids.certBag as string;
  const cert = p12.getBags({ bagType: CERTBAG })[CERTBAG]?.[0]?.cert;

  const campos = new Map<string, string>();
  const ext = cert?.extensions.find((e: { name?: string }) => e.name === 'subjectAltName') as { value?: string } | undefined;
  if (ext?.value) {
    // Percorre a árvore ASN.1: cada otherName é um OID seguido do valor.
    let oid: string | null = null;
    const andar = (no: forge.asn1.Asn1) => {
      if (Array.isArray(no.value)) {
        for (const filho of no.value) andar(filho);
      } else if (no.type === forge.asn1.Type.OID) {
        oid = forge.asn1.derToOid(no.value as string);
      } else if (oid && typeof no.value === 'string') {
        if (!campos.has(oid)) campos.set(oid, no.value.replace(/[^\x20-\x7e]/g, '').trim());
        oid = null;
      }
    };
    andar(forge.asn1.fromDer(ext.value));
  }

  const dadosPf = campos.get('2.16.76.1.3.4') ?? '';
  const cpf = dadosPf.slice(8, 19).replace(/\D/g, '');
  const cnpjSan = (campos.get('2.16.76.1.3.3') ?? '').replace(/\D/g, '');

  return {
    ...ficha,
    cnpj: ficha.cnpj || cnpjSan,
    razaoSocial: ficha.titular.split(':')[0]?.trim() ?? '',
    responsavelNome: campos.get('2.16.76.1.3.2') || null,
    responsavelCpf: cpf.length === 11 && cpf !== '00000000000' ? cpf : null,
  };
}
