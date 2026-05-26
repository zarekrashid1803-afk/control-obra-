import { Workbook, Worksheet } from 'exceljs';

// Paleta visual heredada del PDF de propuesta
export const COLORS = {
  navy900: 'FF0D2540',
  navy700: 'FF1A3A5C',
  navy50:  'FFF4F7FB',
  gold500: 'FFC9A64A',
  gold100: 'FFFDF8EC',
  textPrimary: 'FF111827',
  textMuted: 'FF6B7280',
  borderLight: 'FFE5E7EB',
  white: 'FFFFFFFF',
};

export interface ReportMeta {
  titulo: string;
  subtitulo?: string;
  generadoPor: string;
  filtros?: Record<string, string>;
}

/**
 * Crea un workbook con el branding del sistema y un sheet inicial.
 * Devuelve el workbook y el sheet listo para llenar.
 */
export function nuevoReporte(meta: ReportMeta, nombreSheet = 'Datos'): { wb: Workbook; sheet: Worksheet; siguienteFila: number } {
  const wb = new Workbook();
  wb.creator = 'Control de Obra · Constructora Andina';
  wb.created = new Date();
  wb.company = 'Constructora Andina S.A.S.';

  const sheet = wb.addWorksheet(nombreSheet, {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1 },
  });

  // ============ ENCABEZADO DE MARCA ============
  // Fila 1: logo placeholder (texto "CO") + título
  sheet.mergeCells('A1:B3');
  const logoCell = sheet.getCell('A1');
  logoCell.value = 'CO';
  logoCell.font = { name: 'Arial', size: 28, bold: true, color: { argb: COLORS.navy900 } };
  logoCell.alignment = { horizontal: 'center', vertical: 'middle' };
  logoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gold500 } };
  logoCell.border = { right: { style: 'medium', color: { argb: COLORS.navy900 } } };

  sheet.mergeCells('C1:L1');
  const titleCell = sheet.getCell('C1');
  titleCell.value = 'CONTROL DE OBRA · CONSTRUCTORA ANDINA';
  titleCell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.navy700 } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.mergeCells('C2:L2');
  const subCell = sheet.getCell('C2');
  subCell.value = meta.titulo.toUpperCase();
  subCell.font = { name: 'Calibri', size: 18, bold: true, color: { argb: COLORS.navy900 } };
  subCell.alignment = { horizontal: 'left', vertical: 'middle' };

  sheet.mergeCells('C3:L3');
  const detailCell = sheet.getCell('C3');
  detailCell.value = meta.subtitulo || '';
  detailCell.font = { name: 'Calibri', size: 11, italic: true, color: { argb: COLORS.textMuted } };
  detailCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // ============ METADATA ============
  sheet.getRow(4).height = 6;

  let fila = 5;
  sheet.getCell(`A${fila}`).value = 'Generado:';
  sheet.getCell(`A${fila}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.textMuted } };
  sheet.getCell(`B${fila}`).value = new Date().toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' });
  sheet.getCell(`B${fila}`).font = { name: 'Calibri', size: 9, color: { argb: COLORS.textPrimary } };
  sheet.getCell(`D${fila}`).value = 'Generado por:';
  sheet.getCell(`D${fila}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.textMuted } };
  sheet.getCell(`E${fila}`).value = meta.generadoPor;
  sheet.getCell(`E${fila}`).font = { name: 'Calibri', size: 9, color: { argb: COLORS.textPrimary } };
  fila++;

  // Filtros aplicados
  if (meta.filtros && Object.keys(meta.filtros).length > 0) {
    sheet.getCell(`A${fila}`).value = 'Filtros:';
    sheet.getCell(`A${fila}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: COLORS.textMuted } };
    const filtrosStr = Object.entries(meta.filtros).map(([k, v]) => `${k}: ${v}`).join(' · ');
    sheet.mergeCells(`B${fila}:L${fila}`);
    sheet.getCell(`B${fila}`).value = filtrosStr;
    sheet.getCell(`B${fila}`).font = { name: 'Calibri', size: 9, color: { argb: COLORS.textPrimary } };
    fila++;
  }

  // Espacio antes de los datos
  sheet.getRow(fila).height = 12;
  fila++;

  return { wb, sheet, siguienteFila: fila };
}

/**
 * Aplica estilo de cabecera de tabla a una fila completa.
 */
export function estiloHeader(sheet: Worksheet, fila: number, columnas: number) {
  for (let c = 1; c <= columnas; c++) {
    const cell = sheet.getCell(fila, c);
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.navy700 } };
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = { bottom: { style: 'medium', color: { argb: COLORS.navy900 } } };
  }
  sheet.getRow(fila).height = 22;
}

export function estiloMoneda(cell: any) {
  cell.numFmt = '"$"#,##0;[Red]"$"#,##0';
  cell.alignment = { horizontal: 'right' };
  cell.font = { name: 'Calibri', size: 10 };
}

export function estiloTotalFila(sheet: Worksheet, fila: number, columnas: number) {
  for (let c = 1; c <= columnas; c++) {
    const cell = sheet.getCell(fila, c);
    cell.font = { ...(cell.font || {}), bold: true, color: { argb: COLORS.navy900 } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.gold100 } };
    cell.border = { top: { style: 'medium', color: { argb: COLORS.navy900 } } };
  }
}

export function autoAjustarColumnas(sheet: Worksheet) {
  sheet.columns.forEach((col) => {
    if (!col) return;
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const valor = cell.value;
      let len = 0;
      if (valor == null) len = 0;
      else if (typeof valor === 'object' && 'richText' in (valor as any)) len = String((valor as any).richText).length;
      else len = String(valor).length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 50);
  });
}

/** Convierte un BigInt o number de centavos a número decimal en pesos */
export function centavosAPesos(centavos: bigint | number | null | undefined): number {
  if (centavos == null) return 0;
  return Number(centavos) / 100;
}
