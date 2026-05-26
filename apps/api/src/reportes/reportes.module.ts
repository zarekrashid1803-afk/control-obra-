import { Controller, Get, Module, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportesService } from './reportes.service';
import { RequireRoles } from '../common/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';

function parseFecha(v?: string): Date | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

function setExcelHeaders(res: Response, filename: string) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
}

@ApiTags('reportes')
@ApiBearerAuth()
@Controller('reportes')
class ReportesController {
  constructor(private svc: ReportesService) {}

  @Get('consumo-presupuestal')
  @RequireRoles('admin', 'director', 'auditor')
  @ApiOperation({ summary: 'Reporte Excel: consumo presupuestal por frente' })
  async consumoPresupuestal(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const nombre = `${user.nombres} ${user.apellidos}`;
    const buffer = await this.svc.consumoPresupuestal(nombre);
    const filename = `Consumo-Presupuestal-${new Date().toISOString().slice(0, 10)}.xlsx`;
    setExcelHeaders(res, filename);
    res.send(buffer);
  }

  @Get('requisiciones')
  @RequireRoles('admin', 'director', 'auditor', 'compras')
  async requisiciones(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Query('frenteId') frenteId?: string,
  ) {
    const nombre = `${user.nombres} ${user.apellidos}`;
    const buffer = await this.svc.requisiciones({ desde: parseFecha(desde), hasta: parseFecha(hasta) }, nombre, frenteId);
    const filename = `Requisiciones-${new Date().toISOString().slice(0, 10)}.xlsx`;
    setExcelHeaders(res, filename);
    res.send(buffer);
  }

  @Get('ordenes-compra')
  @RequireRoles('admin', 'director', 'auditor', 'compras')
  async ordenesCompra(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const nombre = `${user.nombres} ${user.apellidos}`;
    const buffer = await this.svc.ordenesCompra({ desde: parseFecha(desde), hasta: parseFecha(hasta) }, nombre);
    const filename = `Ordenes-Compra-${new Date().toISOString().slice(0, 10)}.xlsx`;
    setExcelHeaders(res, filename);
    res.send(buffer);
  }

  @Get('caja-menor')
  @RequireRoles('admin', 'director', 'auditor', 'caja')
  async cajaMenor(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const nombre = `${user.nombres} ${user.apellidos}`;
    const buffer = await this.svc.cajaMenor({ desde: parseFecha(desde), hasta: parseFecha(hasta) }, nombre);
    const filename = `Caja-Menor-${new Date().toISOString().slice(0, 10)}.xlsx`;
    setExcelHeaders(res, filename);
    res.send(buffer);
  }

  @Get('auditoria')
  @RequireRoles('admin', 'director', 'auditor')
  async auditoria(
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    const nombre = `${user.nombres} ${user.apellidos}`;
    const buffer = await this.svc.auditoria({ desde: parseFecha(desde), hasta: parseFecha(hasta) }, nombre);
    const filename = `Auditoria-${new Date().toISOString().slice(0, 10)}.xlsx`;
    setExcelHeaders(res, filename);
    res.send(buffer);
  }
}

@Module({
  providers: [ReportesService],
  controllers: [ReportesController],
  exports: [ReportesService],
})
export class ReportesModule {}
