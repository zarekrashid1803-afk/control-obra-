import { encryptSecret, decryptSecret } from './crypto.util';

/**
 * Cifrado de secretos en reposo (AES-256-GCM). Verifica el roundtrip, que el
 * texto cifrado no contenga el secreto, que cada cifrado use IV distinto, y la
 * tolerancia hacia atrás con secretos en texto plano previos.
 */
describe('crypto.util — encrypt/decrypt', () => {
  it('roundtrip: descifrar lo cifrado devuelve el original', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it('el texto cifrado NO contiene el secreto en claro y lleva el prefijo enc:v1:', () => {
    const secret = 'TOPSECRETTOTPKEY';
    const enc = encryptSecret(secret);
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(enc).not.toContain(secret);
  });

  it('dos cifrados del mismo secreto difieren (IV aleatorio) pero ambos descifran igual', () => {
    const secret = 'SAMEINPUTKEY1234';
    const a = encryptSecret(secret);
    const b = encryptSecret(secret);
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe(secret);
    expect(decryptSecret(b)).toBe(secret);
  });

  it('tolerancia hacia atrás: un valor en texto plano se devuelve tal cual', () => {
    // Secretos guardados antes de este cambio no tienen el prefijo.
    expect(decryptSecret('PLAINTEXTSECRET1')).toBe('PLAINTEXTSECRET1');
  });

  it('manipular el texto cifrado (tag inválido) lanza error', () => {
    const enc = encryptSecret('ABCDEFGHIJKLMNOP');
    const tampered = enc.slice(0, -4) + 'AAAA';
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
