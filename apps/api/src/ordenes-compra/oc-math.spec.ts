import { aplicarDescuento } from './oc-math';

/**
 * Regresión del bug donde (100 - pct*100)/100 daba factores negativos y
 * subtotales negativos para cualquier descuento > 0.
 */
describe('aplicarDescuento', () => {
  it('sin descuento devuelve el monto íntegro', () => {
    expect(aplicarDescuento(100000n, 0)).toBe(100000n);
  });

  it('10% de descuento → 90% del monto', () => {
    expect(aplicarDescuento(100000n, 10)).toBe(90000n);
  });

  it('descuento con decimales (7.5%) → 92.5% del monto', () => {
    expect(aplicarDescuento(100000n, 7.5)).toBe(92500n);
  });

  it('100% de descuento → 0', () => {
    expect(aplicarDescuento(100000n, 100)).toBe(0n);
  });

  it('NUNCA produce negativos aunque el pct sea absurdo (>100)', () => {
    expect(aplicarDescuento(100000n, 150)).toBe(0n);
  });

  it('pct negativo se trata como 0% (no infla el monto)', () => {
    expect(aplicarDescuento(100000n, -10)).toBe(100000n);
  });
});
