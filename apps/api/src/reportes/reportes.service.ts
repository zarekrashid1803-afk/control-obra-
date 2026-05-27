import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  nuevoReporte, estiloHeader, estiloMoneda, estiloTotalFila, autoAjustarColumnas,
  centavosAPesos, ReportMeta,
} from './excel-styles';

export interface FechaRango {
  desde?: Date;
  hasta?: Date;
}

@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  // ============================================================
  // REPORTE 1: Consumo presupuestal por frente
  // ============================================================
  async consumoPresupuestal(generadoPor: string, tenantId: number): Promise<Buffer> {
    const frentes = await this.prisma.frenteObra.findMany({
      where: { deletedAt: null, tenantId },
      orderBy: { codigo: 'asc' },
      include: {
        responsable: { select: { nombres: true, apellidos: true } },
      },
    });

    const meta: ReportMeta = {
      titulo: 'Consumo presupuestal por frente',
      subtitulo: 'Resumen ejecutivo del estado financiero de cada centro de costos',
      generadoPor,
    };
    const { wb, sheet, siguienteFila } = nuevoReporte(meta, 'Consumo');

    const headers = ['Código', 'Frente', 'Responsable', 'Estado', 'Presupuesto', 'Consumido', 'Disponible', '% Consumido', 'Alerta'];
    headers.forEach((h, i) => sheet.getCell(siguienteFila, i + 1).value = h);
    estiloHeader(sheet, siguienteFila, headers.length);

    let fila = siguienteFila + 1;
    let totalPresupuesto = 0;
    let totalConsumido = 0;

    for (const f of frentes) {
      const presupuesto = centavosAPesos(f.presupuestoTotalCentavos);
      const consumido = centavosAPesos(f.consumidoCentavos);
      const disponible = presupuesto - consumido;
      const pct = presupuesto > 0 ? consumido / presupuesto : 0;
      totalPresupuesto += presupuesto;
      totalConsumido += consumido;

      sheet.getCell(fila, 1).value = f.codigo;
      sheet.getCell(fila, 2).value = f.nombre;
      sheet.getCell(fila, 3).value = f.responsable ? `${f.responsable.nombres} ${f.responsable.apellidos}` : '—';
      sheet.getCell(fila, 4).value = f.estado;
      sheet.getCell(fila, 5).value = presupuesto;
      estiloMoneda(sheet.getCell(fila, 5));
      sheet.getCell(fila, 6).value = consumido;
      estiloMoneda(sheet.getCell(fila, 6));
      sheet.getCell(fila, 7).value = disponible;
      estiloMoneda(sheet.getCell(fila, 7));
      sheet.getCell(fila, 8).value = pct;
      sheet.getCell(fila, 8).numFmt = '0.0%';
      sheet.getCell(fila, 9).value = pct > 0.85 ? 'CRÍTICO' : pct > 0.7 ? 'Atención' : 'OK';
      sheet.getCell(fila, 9).font = {
        bold: true,
        color: { argb: pct > 0.85 ? 'FFDC2626' : pct > 0.7 ? 'FFD97706' : 'FF059669' },
      };
      fila++;
    }

    // Totales
    sheet.getCell(fila, 1).value = '';
    sheet.getCell(fila, 2).value = `TOTAL · ${frentes.length} frentes`;
    sheet.getCell(fila, 5).value = totalPresupuesto;
    estiloMoneda(sheet.getCell(fila, 5));
    sheet.getCell(fila, 6).value = totalConsumido;
    estiloMoneda(sheet.getCell(fila, 6));
    sheet.getCell(fila, 7).value = totalPresupuesto - totalConsumido;
    estiloMoneda(sheet.getCell(fila, 7));
    sheet.getCell(fila, 8).value = totalPresupuesto > 0 ? totalConsumido / totalPresupuesto : 0;
    sheet.getCell(fila, 8).numFmt = '0.0%';
    estiloTotalFila(sheet, fila, headers.length);

    autoAjustarColumnas(sheet);
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ============================================================
  // REPORTE 2: Requisiciones del período
  // ============================================================
  async requisiciones(rango: FechaRango, generadoPor: string, tenantId: number, frenteId?: string): Promise<Buffer> {
    const where: any = { deletedAt: null, tenantId };
    if (rango.desde || rango.hasta) {
      where.fechaCreacion = {};
      if (rango.desde) where.fechaCreacion.gte = rango.desde;
      if (rango.hasta) where.fechaCreacion.lte = rango.hasta;
    }
    if (frenteId) where.frenteId = frenteId;

    const reqs = await this.prisma.requisicion.findMany({
      where,
      orderBy: { fechaCreacion: 'desc' },
      include: {
        frente: { select: { codigo: true, nombre: true } },
        solicitante: { select: { nombres: true, apellidos: true } },
        aprobador: { select: { nombres: true, apellidos: true } },
      },
    });

    const filtros: Record<string, string> = {};
    if (rango.desde) filtros['Desde'] = rango.desde.toLocaleDateString('es-CO');
    if (rango.hasta) filtros['Hasta'] = rango.hasta.toLocaleDateString('es-CO');
    if (frenteId) {
      const frente = await this.prisma.frenteObra.findUnique({ where: { id: frenteId } });
      if (frente) filtros['Frente'] = `${frente.codigo} ${frente.nombre}`;
    }

    const { wb, sheet, siguienteFila } = nuevoReporte({
      titulo: 'Requisiciones del período',
      subtitulo: `${reqs.length} solicitudes encontradas`,
      generadoPor,
      filtros,
    }, 'Requisiciones');

    const headers = ['Código', 'Fecha', 'Frente', 'Solicitante', 'Descripción', 'Items', 'Subtotal', 'IVA', 'Total', 'Estado', 'Aprobador', 'Sobre Presup.'];
    headers.forEach((h, i) => sheet.getCell(siguienteFila, i + 1).value = h);
    estiloHeader(sheet, siguienteFila, headers.length);

    let fila = siguienteFila + 1;
    let totalSubtotal = 0;
    let totalIva = 0;
    let totalGeneral = 0;

    for (const r of reqs) {
      sheet.getCell(fila, 1).value = r.codigo;
      sheet.getCell(fila, 2).value = r.fechaCreacion;
      sheet.getCell(fila, 2).numFmt = 'dd/mm/yyyy hh:mm';
      sheet.getCell(fila, 3).value = `${r.frente.codigo} ${r.frente.nombre}`;
      sheet.getCell(fila, 4).value = `${r.solicitante.nombres} ${r.solicitante.apellidos}`;
      sheet.getCell(fila, 5).value = r.descripcion;
      sheet.getCell(fila, 6).value = 0; // count se hace abajo
      const subtotal = centavosAPesos(r.subtotalCentavos);
      const iva = centavosAPesos(r.ivaCentavos);
      const total = centavosAPesos(r.totalCentavos);
      totalSubtotal += subtotal;
      totalIva += iva;
      totalGeneral += total;
      sheet.getCell(fila, 7).value = subtotal;
      estiloMoneda(sheet.getCell(fila, 7));
      sheet.getCell(fila, 8).value = iva;
      estiloMoneda(sheet.getCell(fila, 8));
      sheet.getCell(fila, 9).value = total;
      estiloMoneda(sheet.getCell(fila, 9));
      sheet.getCell(fila, 10).value = r.estado;
      sheet.getCell(fila, 11).value = r.aprobador ? `${r.aprobador.nombres} ${r.aprobador.apellidos}` : '—';
      sheet.getCell(fila, 12).value = r.sobrePresupuesto ? 'SÍ' : '—';
      if (r.sobrePresupuesto) {
        sheet.getCell(fila, 12).font = { bold: true, color: { argb: 'FFDC2626' } };
      }
      fila++;
    }

    // Calcular items por requisición (necesita query separada)
    const items = await this.prisma.requisicionItem.groupBy({
      by: ['requisicionId'],
      _count: { _all: true },
      where: { requisicionId: { in: reqs.map(r => r.id) } },
    });
    const itemsMap = new Map(items.map(i => [i.requisicionId, i._count._all]));
    reqs.forEach((r, idx) => {
      sheet.getCell(siguienteFila + 1 + idx, 6).value = itemsMap.get(r.id) || 0;
    });

    // Totales
    sheet.getCell(fila, 1).value = 'TOTAL';
    sheet.getCell(fila, 7).value = totalSubtotal;
    estiloMoneda(sheet.getCell(fila, 7));
    sheet.getCell(fila, 8).value = totalIva;
    estiloMoneda(sheet.getCell(fila, 8));
    sheet.getCell(fila, 9).value = totalGeneral;
    estiloMoneda(sheet.getCell(fila, 9));
    estiloTotalFila(sheet, fila, headers.length);

    autoAjustarColumnas(sheet);
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ============================================================
  // REPORTE 3: Órdenes de compra por proveedor
  // ============================================================
  async ordenesCompra(rango: FechaRango, generadoPor: string, tenantId: number): Promise<Buffer> {
    const where: any = { tenantId };
    if (rango.desde || rango.hasta) {
      where.fechaEmision = {};
      if (rango.desde) where.fechaEmision.gte = rango.desde;
      if (rango.hasta) where.fechaEmision.lte = rango.hasta;
    }

    const ocs = await this.prisma.ordenCompra.findMany({
      where,
      orderBy: { fechaEmision: 'desc' },
      include: {
        proveedor: { select: { razonSocial: true, nit: true } },
        frente: { select: { codigo: true, nombre: true } },
        generadaPor: { select: { nombres: true, apellidos: true } },
      },
    });

    const filtros: Record<string, string> = {};
    if (rango.desde) filtros['Desde'] = rango.desde.toLocaleDateString('es-CO');
    if (rango.hasta) filtros['Hasta'] = rango.hasta.toLocaleDateString('es-CO');

    const { wb, sheet, siguienteFila } = nuevoReporte({
      titulo: 'Órdenes de compra emitidas',
      subtitulo: `${ocs.length} OCs en el período`,
      generadoPor,
      filtros,
    }, 'OCs');

    const headers = ['Código', 'Fecha', 'Proveedor', 'NIT', 'Frente', 'Subtotal', 'IVA', 'ReteFte', 'ReteIVA', 'ReteICA', 'Total', 'Estado', 'Generada por'];
    headers.forEach((h, i) => sheet.getCell(siguienteFila, i + 1).value = h);
    estiloHeader(sheet, siguienteFila, headers.length);

    let fila = siguienteFila + 1;
    let totSub = 0, totIva = 0, totRetFte = 0, totRetIva = 0, totRetIca = 0, totGen = 0;

    for (const oc of ocs) {
      sheet.getCell(fila, 1).value = oc.codigo;
      sheet.getCell(fila, 2).value = oc.fechaEmision;
      sheet.getCell(fila, 2).numFmt = 'dd/mm/yyyy';
      sheet.getCell(fila, 3).value = oc.proveedor.razonSocial;
      sheet.getCell(fila, 4).value = oc.proveedor.nit;
      sheet.getCell(fila, 5).value = `${oc.frente.codigo} ${oc.frente.nombre}`;
      const sub = centavosAPesos(oc.subtotalCentavos); totSub += sub;
      const iva = centavosAPesos(oc.ivaCentavos); totIva += iva;
      const rf = centavosAPesos(oc.retencionFuenteCentavos); totRetFte += rf;
      const ri = centavosAPesos(oc.retencionIvaCentavos); totRetIva += ri;
      const ric = centavosAPesos(oc.retencionIcaCentavos); totRetIca += ric;
      const tot = centavosAPesos(oc.totalCentavos); totGen += tot;
      [sub, iva, rf, ri, ric, tot].forEach((v, i) => {
        sheet.getCell(fila, 6 + i).value = v;
        estiloMoneda(sheet.getCell(fila, 6 + i));
      });
      sheet.getCell(fila, 12).value = oc.estado.replace(/_/g, ' ');
      sheet.getCell(fila, 13).value = `${oc.generadaPor.nombres} ${oc.generadaPor.apellidos}`;
      fila++;
    }

    sheet.getCell(fila, 1).value = 'TOTAL';
    [totSub, totIva, totRetFte, totRetIva, totRetIca, totGen].forEach((v, i) => {
      sheet.getCell(fila, 6 + i).value = v;
      estiloMoneda(sheet.getCell(fila, 6 + i));
    });
    estiloTotalFila(sheet, fila, headers.length);

    autoAjustarColumnas(sheet);
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ============================================================
  // REPORTE 4: Caja menor del período
  // ============================================================
  async cajaMenor(rango: FechaRango, generadoPor: string, tenantId: number): Promise<Buffer> {
    const where: any = { tenantId };
    if (rango.desde || rango.hasta) {
      where.fechaMovimiento = {};
      if (rango.desde) where.fechaMovimiento.gte = rango.desde;
      if (rango.hasta) where.fechaMovimiento.lte = rango.hasta;
    }

    const movs = await this.prisma.movimientoCaja.findMany({
      where,
      orderBy: { fechaMovimiento: 'asc' },
      include: {
        frente: { select: { codigo: true, nombre: true } },
        proveedor: { select: { razonSocial: true } },
        autorizadoPor: { select: { nombres: true, apellidos: true } },
      },
    });

    const filtros: Record<string, string> = {};
    if (rango.desde) filtros['Desde'] = rango.desde.toLocaleDateString('es-CO');
    if (rango.hasta) filtros['Hasta'] = rango.hasta.toLocaleDateString('es-CO');

    const { wb, sheet, siguienteFila } = nuevoReporte({
      titulo: 'Caja menor — movimientos',
      subtitulo: `${movs.length} movimientos en el período`,
      generadoPor,
      filtros,
    }, 'Caja');

    const headers = ['Código', 'Fecha', 'Tipo', 'Concepto', 'Frente', 'Proveedor', 'Categoría', 'Monto', 'Reten Fte', 'Reten IVA', 'Reten ICA', 'Neto', 'Autorizado por'];
    headers.forEach((h, i) => sheet.getCell(siguienteFila, i + 1).value = h);
    estiloHeader(sheet, siguienteFila, headers.length);

    let fila = siguienteFila + 1;
    let totalEntradas = 0;
    let totalSalidas = 0;
    let totalRetenciones = 0;

    for (const m of movs) {
      sheet.getCell(fila, 1).value = m.codigo;
      sheet.getCell(fila, 2).value = m.fechaMovimiento;
      sheet.getCell(fila, 2).numFmt = 'dd/mm/yyyy hh:mm';
      sheet.getCell(fila, 3).value = m.tipo;
      sheet.getCell(fila, 3).font = {
        bold: true,
        color: { argb: m.tipo === 'entrada' ? 'FF059669' : m.tipo === 'salida' ? 'FFDC2626' : 'FFD97706' },
      };
      sheet.getCell(fila, 4).value = m.concepto;
      sheet.getCell(fila, 5).value = m.frente ? `${m.frente.codigo} ${m.frente.nombre}` : '—';
      sheet.getCell(fila, 6).value = m.proveedor?.razonSocial || '—';
      sheet.getCell(fila, 7).value = m.categoria || '—';
      const monto = centavosAPesos(m.montoCentavos);
      const rf = centavosAPesos(m.retencionFuenteCentavos);
      const ri = centavosAPesos(m.retencionIvaCentavos);
      const ric = centavosAPesos(m.retencionIcaCentavos);
      const neto = monto - rf - ri - ric;
      if (m.tipo === 'entrada') totalEntradas += monto;
      else if (m.tipo === 'salida') totalSalidas += monto;
      totalRetenciones += rf + ri + ric;

      sheet.getCell(fila, 8).value = monto;
      estiloMoneda(sheet.getCell(fila, 8));
      sheet.getCell(fila, 9).value = rf;
      estiloMoneda(sheet.getCell(fila, 9));
      sheet.getCell(fila, 10).value = ri;
      estiloMoneda(sheet.getCell(fila, 10));
      sheet.getCell(fila, 11).value = ric;
      estiloMoneda(sheet.getCell(fila, 11));
      sheet.getCell(fila, 12).value = neto;
      estiloMoneda(sheet.getCell(fila, 12));
      sheet.getCell(fila, 13).value = `${m.autorizadoPor.nombres} ${m.autorizadoPor.apellidos}`;
      fila++;
    }

    sheet.getCell(fila, 1).value = 'TOTAL';
    sheet.getCell(fila, 3).value = 'Entradas';
    sheet.getCell(fila, 8).value = totalEntradas;
    estiloMoneda(sheet.getCell(fila, 8));
    estiloTotalFila(sheet, fila, headers.length);
    fila++;
    sheet.getCell(fila, 3).value = 'Salidas';
    sheet.getCell(fila, 8).value = totalSalidas;
    estiloMoneda(sheet.getCell(fila, 8));
    estiloTotalFila(sheet, fila, headers.length);
    fila++;
    sheet.getCell(fila, 3).value = 'Saldo neto';
    sheet.getCell(fila, 8).value = totalEntradas - totalSalidas;
    estiloMoneda(sheet.getCell(fila, 8));
    sheet.getCell(fila, 9).value = totalRetenciones;
    estiloMoneda(sheet.getCell(fila, 9));
    sheet.getCell(fila, 9).font = { ...(sheet.getCell(fila, 9).font || {}), italic: true };
    estiloTotalFila(sheet, fila, headers.length);

    autoAjustarColumnas(sheet);
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  // ============================================================
  // REPORTE 5: Auditoría para revisor fiscal
  // ============================================================
  async auditoria(rango: FechaRango, generadoPor: string, tenantId: number): Promise<Buffer> {
    const where: any = { tenantId };
    if (rango.desde || rango.hasta) {
      where.creadoAt = {};
      if (rango.desde) where.creadoAt.gte = rango.desde;
      if (rango.hasta) where.creadoAt.lte = rango.hasta;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      orderBy: { creadoAt: 'desc' },
      take: 5000,
      include: {
        actor: { select: { nombres: true, apellidos: true, email: true } },
      },
    });

    const filtros: Record<string, string> = {};
    if (rango.desde) filtros['Desde'] = rango.desde.toLocaleDateString('es-CO');
    if (rango.hasta) filtros['Hasta'] = rango.hasta.toLocaleDateString('es-CO');

    const { wb, sheet, siguienteFila } = nuevoReporte({
      titulo: 'Bitácora de auditoría',
      subtitulo: `${logs.length} eventos · bitácora inmutable PostgreSQL`,
      generadoPor,
      filtros,
    }, 'Auditoría');

    const headers = ['Fecha y hora', 'Usuario', 'Email', 'Acción', 'Entidad', 'ID Entidad', 'IP', 'User-Agent', 'Cambios (JSON)'];
    headers.forEach((h, i) => sheet.getCell(siguienteFila, i + 1).value = h);
    estiloHeader(sheet, siguienteFila, headers.length);

    let fila = siguienteFila + 1;
    for (const l of logs) {
      sheet.getCell(fila, 1).value = l.creadoAt;
      sheet.getCell(fila, 1).numFmt = 'dd/mm/yyyy hh:mm:ss';
      sheet.getCell(fila, 2).value = l.actor ? `${l.actor.nombres} ${l.actor.apellidos}` : 'Sistema';
      sheet.getCell(fila, 3).value = l.actor?.email || '—';
      sheet.getCell(fila, 4).value = l.accion;
      sheet.getCell(fila, 4).font = { name: 'Consolas', size: 9 };
      sheet.getCell(fila, 5).value = l.entidad;
      sheet.getCell(fila, 6).value = l.entidadId || '—';
      sheet.getCell(fila, 6).font = { name: 'Consolas', size: 9 };
      sheet.getCell(fila, 7).value = l.ip || '—';
      sheet.getCell(fila, 8).value = (l.userAgent || '—').substring(0, 100);
      sheet.getCell(fila, 8).font = { name: 'Calibri', size: 8 };
      const cambiosStr = l.cambios ? JSON.stringify(l.cambios).substring(0, 500) : '';
      sheet.getCell(fila, 9).value = cambiosStr;
      sheet.getCell(fila, 9).font = { name: 'Consolas', size: 8 };
      sheet.getCell(fila, 9).alignment = { wrapText: false };
      fila++;
    }

    autoAjustarColumnas(sheet);
    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
