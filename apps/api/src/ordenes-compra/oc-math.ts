/**
 * Aplica un descuento porcentual a un monto en centavos, en aritmética entera.
 * descuentoPct es un porcentaje (ej. 10 = 10%, 7.5 = 7.5%). Se trabaja en base
 * 10000 (puntos básicos × 100) para soportar hasta 2 decimales de porcentaje.
 *
 * Antes el cálculo usaba (100 - pct*100)/100, que para cualquier descuento > 0
 * daba un factor NEGATIVO y subtotales negativos. Esta función lo corrige.
 */
export function aplicarDescuento(montoCentavos: bigint, descuentoPct: number): bigint {
  const factorBps = 10000 - Math.round((descuentoPct || 0) * 100); // 10% → 9000
  const clamped = Math.min(10000, Math.max(0, factorBps)); // descuento en [0%, 100%]
  return (montoCentavos * BigInt(clamped)) / 10000n;
}
