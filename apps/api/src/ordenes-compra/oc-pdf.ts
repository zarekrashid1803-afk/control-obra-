import PDFDocument from 'pdfkit';

/**
 * Genera el PDF de una Orden de Compra como Buffer.
 * Layout estilo factura corporativa, blanco/negro/gris para impresión limpia.
 */
export function generarOCPdf(oc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const COP = (cents: bigint | string | number) => {
        const n = Number(cents) / 100;
        return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
      };
      const FMT_DATE = (d: Date | string | null | undefined) => {
        if (!d) return '—';
        const date = new Date(d);
        return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
      };

      // ============================================================
      // HEADER
      // ============================================================
      doc.fontSize(9).fillColor('#686B6C').text('PROJECT BY ORION', 50, 50, { characterSpacing: 2 });
      doc.fontSize(20).fillColor('#000').font('Helvetica-Bold').text('ORDEN DE COMPRA', 50, 70);

      // Caja con código y fecha (derecha)
      const boxX = 380, boxY = 50, boxW = 165;
      doc.rect(boxX, boxY, boxW, 70).fillAndStroke('#000', '#000');
      doc.fillColor('#fff').fontSize(8).font('Helvetica').text('NÚMERO', boxX + 10, boxY + 8, { characterSpacing: 1 });
      doc.fontSize(16).font('Courier-Bold').text(oc.codigo || '—', boxX + 10, boxY + 20);
      doc.fontSize(8).font('Helvetica').text('FECHA EMISIÓN', boxX + 10, boxY + 45, { characterSpacing: 1 });
      doc.fontSize(11).font('Helvetica-Bold').text(FMT_DATE(oc.fechaEmision || oc.createdAt), boxX + 10, boxY + 56);

      // ============================================================
      // INFO PROVEEDOR + FRENTE
      // ============================================================
      let y = 150;
      doc.fillColor('#000').fontSize(9).font('Helvetica-Bold').text('PROVEEDOR', 50, y, { characterSpacing: 1 });
      doc.fontSize(12).font('Helvetica-Bold').text(oc.proveedor?.razonSocial || '—', 50, y + 14);
      doc.fontSize(10).font('Helvetica').fillColor('#1a1a1a')
        .text(`NIT: ${oc.proveedor?.nit || '—'}`, 50, y + 32)
        .text(oc.proveedor?.direccion || '', 50, y + 46)
        .text(oc.proveedor?.email || '', 50, y + 60);

      doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text('FRENTE / CENTRO DE COSTOS', 320, y, { characterSpacing: 1 });
      doc.fontSize(11).font('Helvetica-Bold').text(`${oc.frente?.codigo || ''} — ${oc.frente?.nombre || '—'}`, 320, y + 14);
      doc.fontSize(9).font('Helvetica').fillColor('#1a1a1a')
        .text(`Requisición: ${oc.requisicion?.codigo || '—'}`, 320, y + 32);
      if (oc.fechaEntregaEstimada) {
        doc.text(`Entrega estimada: ${FMT_DATE(oc.fechaEntregaEstimada)}`, 320, y + 46);
      }

      // ============================================================
      // TABLA DE ITEMS
      // ============================================================
      y = 240;
      doc.rect(50, y, 495, 20).fill('#000');
      doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
      doc.text('#', 55, y + 6);
      doc.text('DESCRIPCIÓN', 80, y + 6);
      doc.text('CANT.', 340, y + 6, { width: 50, align: 'right' });
      doc.text('PRECIO UNIT', 395, y + 6, { width: 70, align: 'right' });
      doc.text('SUBTOTAL', 470, y + 6, { width: 70, align: 'right' });

      y += 20;
      let zebra = false;
      doc.font('Helvetica').fontSize(9).fillColor('#000');
      (oc.items || []).forEach((it: any, i: number) => {
        // Salto de página si nos pasamos
        if (y > 680) {
          doc.addPage();
          y = 50;
        }
        if (zebra) {
          doc.rect(50, y, 495, 22).fill('#f5f6f7');
        }
        zebra = !zebra;
        doc.fillColor('#000');
        doc.text(String(i + 1), 55, y + 6);
        const nombre = it.material?.nombre || it.descripcionSnapshot || '—';
        doc.text(nombre, 80, y + 6, { width: 250, ellipsis: true });
        doc.text(String(it.cantidad), 340, y + 6, { width: 50, align: 'right' });
        doc.text(COP(it.precioUnitarioCentavos || 0), 395, y + 6, { width: 70, align: 'right' });
        doc.text(COP(BigInt(it.cantidad) * BigInt(it.precioUnitarioCentavos || 0)), 470, y + 6, { width: 70, align: 'right' });
        y += 22;
      });

      // ============================================================
      // TOTALES
      // ============================================================
      y += 10;
      if (y > 670) { doc.addPage(); y = 50; }

      const totalLine = (label: string, value: string, bold = false) => {
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 12 : 10).fillColor('#000');
        doc.text(label, 350, y, { width: 120, align: 'right' });
        doc.text(value, 470, y, { width: 70, align: 'right' });
        y += bold ? 18 : 14;
      };

      totalLine('Subtotal:', COP(oc.subtotalCentavos || 0));
      if (oc.ivaCentavos) totalLine('IVA (19%):', COP(oc.ivaCentavos));
      if (oc.retencionFuenteCentavos) totalLine('Reten. Fuente:', `- ${COP(oc.retencionFuenteCentavos)}`);
      if (oc.retencionIvaCentavos) totalLine('Reten. IVA:', `- ${COP(oc.retencionIvaCentavos)}`);
      if (oc.retencionIcaCentavos) totalLine('Reten. ICA:', `- ${COP(oc.retencionIcaCentavos)}`);
      doc.moveTo(350, y).lineTo(540, y).strokeColor('#000').lineWidth(1).stroke();
      y += 4;
      totalLine('TOTAL:', COP(oc.totalCentavos || 0), true);

      // ============================================================
      // NOTAS + FIRMA
      // ============================================================
      if (oc.notas) {
        y += 20;
        if (y > 650) { doc.addPage(); y = 50; }
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#000').text('NOTAS', 50, y, { characterSpacing: 1 });
        doc.fontSize(10).font('Helvetica').fillColor('#1a1a1a').text(oc.notas, 50, y + 14, { width: 495 });
        y += 14 + doc.heightOfString(oc.notas, { width: 495 });
      }

      // Firma
      y = Math.max(y, 680);
      if (y > 720) { doc.addPage(); y = 50; }
      doc.moveTo(50, y).lineTo(250, y).strokeColor('#686B6C').lineWidth(0.5).stroke();
      doc.fontSize(9).fillColor('#686B6C').font('Helvetica').text(
        oc.generadaPor ? `${oc.generadaPor.nombres} ${oc.generadaPor.apellidos}` : 'Compras',
        50, y + 4,
      );
      doc.fontSize(8).text('Responsable de compras', 50, y + 18);

      // Footer
      doc.fontSize(7).fillColor('#686B6C').text(
        `Generado el ${new Date().toLocaleString('es-CO')} · Documento sin valor fiscal — comprobante interno`,
        50, 760, { width: 495, align: 'center' },
      );

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}
