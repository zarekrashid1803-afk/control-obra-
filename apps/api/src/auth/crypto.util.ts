import * as crypto from 'crypto';

/**
 * Cifrado simétrico para secretos sensibles en reposo (ej. el secreto TOTP de
 * MFA). Usa AES-256-GCM (autenticado). La clave se deriva de MFA_ENC_KEY o, en
 * su defecto, de JWT_SECRET (que en producción ya es obligatorio y fuerte).
 *
 * Formato del texto cifrado: "enc:v1:<iv b64>:<tag b64>:<data b64>".
 * decrypt() es tolerante a valores en texto plano (secretos previos sin cifrar)
 * para no romper cuentas que ya tenían MFA activo antes de este cambio.
 */

const PREFIX = 'enc:v1:';

function getKey(): Buffer {
  const base = process.env.MFA_ENC_KEY || process.env.JWT_SECRET || 'dev-secret-change-me';
  // sha256 → 32 bytes exactos para AES-256.
  return crypto.createHash('sha256').update(base).digest();
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  // Tolerancia hacia atrás: lo que no tiene el prefijo se asume texto plano.
  if (!stored || !stored.startsWith(PREFIX)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
