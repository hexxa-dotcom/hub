import 'server-only';
import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';

/**
 * Criptografia em repouso pra segredo de terceiro guardado no nosso banco:
 * senha do certificado A1 (assinatura de NFSe) e senha de IMAP (Conectar
 * E-mail). Sem isso, qualquer acesso de leitura ao Postgres (um vazamento,
 * uma policy mal configurada, um backup exposto) expõe a senha em texto
 * puro — no caso do certificado A1, isso equivale a expor a chave que
 * assina documentos fiscais em nome da empresa.
 *
 * AES-256-GCM com chave única do ambiente (ENCRYPTION_KEY, 32 bytes em
 * base64). Formato armazenado: "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>".
 */

const PREFIX = 'v1';

function getKey(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) {
    throw new Error('ENCRYPTION_KEY ausente — necessária para ler/gravar segredos (certificado A1, senha de e-mail).');
  }
  const key = Buffer.from(b64, 'base64');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY inválida — precisa decodificar para exatamente 32 bytes (AES-256).');
  }
  return key;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** Descriptografa. Se o valor não estiver no formato esperado (dado legado
 * ainda em texto puro, de antes desta migração), devolve como veio — evita
 * quebrar em produção antes da re-gravação; ver script de migração. */
export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split(':');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    return stored;
  }
  const [, ivB64, tagB64, ctB64] = parts;
  const iv = Buffer.from(ivB64!, 'base64');
  const tag = Buffer.from(tagB64!, 'base64');
  const ciphertext = Buffer.from(ctB64!, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}
