import { sniffMime } from './adjuntos.module';

/**
 * Valida la detección de tipo por magic bytes. Lo importante de seguridad:
 * el contenido manda, no la extensión ni el mimetype del cliente. Un .exe
 * disfrazado de PNG debe ser rechazado (null).
 */

// Construye un buffer de >=12 bytes con un prefijo dado.
function buf(...bytes: number[]): Buffer {
  const b = Buffer.alloc(16);
  bytes.forEach((v, i) => (b[i] = v));
  return b;
}
function ascii(prefix: string, at = 0): Buffer {
  const b = Buffer.alloc(16);
  b.write(prefix, at, 'ascii');
  return b;
}

describe('sniffMime — detección por contenido', () => {
  it('detecta JPEG (FF D8 FF)', () => {
    expect(sniffMime(buf(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
  });

  it('detecta PNG (89 50 4E 47)', () => {
    expect(sniffMime(buf(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
  });

  it('detecta PDF (%PDF)', () => {
    const b = Buffer.from('%PDF-1.7\n%abcd', 'ascii');
    expect(sniffMime(b)).toBe('application/pdf');
  });

  it('detecta WEBP (RIFF....WEBP)', () => {
    const b = Buffer.alloc(16);
    b.write('RIFF', 0, 'ascii');
    b.write('WEBP', 8, 'ascii');
    expect(sniffMime(b)).toBe('image/webp');
  });

  it('detecta HEIC (ftyp + marca heic)', () => {
    const b = Buffer.alloc(16);
    b.write('ftyp', 4, 'ascii');
    b.write('heic', 8, 'ascii');
    expect(sniffMime(b)).toBe('image/heic');
  });

  it('rechaza un ejecutable disfrazado (MZ...) → null', () => {
    expect(sniffMime(buf(0x4d, 0x5a, 0x90, 0x00))).toBeNull();
  });

  it('rechaza texto plano arbitrario → null', () => {
    expect(sniffMime(Buffer.from('not a real image at all', 'ascii'))).toBeNull();
  });

  it('rechaza buffer demasiado corto → null', () => {
    expect(sniffMime(Buffer.from([0xff, 0xd8]))).toBeNull();
  });

  it('rechaza un ftyp con marca no soportada (mp4) → null', () => {
    expect(sniffMime(ascii('....ftypmp42'))).toBeNull();
  });
});
