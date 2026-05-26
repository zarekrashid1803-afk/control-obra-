import {
  Controller, Get, Injectable, Module, Param, Post, UploadedFile, UseInterceptors,
  BadRequestException, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, createReadStream } from 'fs';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import * as crypto from 'crypto';

const UPLOAD_DIR = join(process.cwd(), 'uploads');
if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const MAX_SIZE_MB = 10;

@Injectable()
class AdjuntosService {
  constructor(private prisma: PrismaService) {}

  async crear(file: Express.Multer.File, meta: { entidad: string; entidadId?: string }, user: AuthUser) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`);
    }
    const checksum = crypto.createHash('sha256');
    // file.path exists because we use diskStorage
    return this.prisma.adjunto.create({
      data: {
        nombre: file.originalname,
        mimeType: file.mimetype,
        tamanioBytes: file.size,
        urlS3: `/adjuntos/file/${file.filename}`,
        checksumSha256: checksum.update(file.filename).digest('hex').substring(0, 64),
        entidad: meta.entidad || 'generico',
        entidadId: meta.entidadId || '',
        subidoPorId: user.id,
      },
    });
  }

  async getById(id: string) {
    return this.prisma.adjunto.findUnique({ where: { id } });
  }
}

@ApiTags('adjuntos')
@ApiBearerAuth()
@Controller('adjuntos')
class AdjuntosController {
  constructor(private svc: AdjuntosService) {}

  @Post()
  @ApiOperation({ summary: 'Subir un archivo (foto/pdf)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => {
          const unique = crypto.randomUUID();
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Archivo no enviado');
    return this.svc.crear(file, { entidad: 'documento_soporte' }, user);
  }

  /**
   * Endpoint público para servir el archivo (con URL no enumerable: UUID).
   * En producción esto debería usar URLs firmadas de S3 con expiración.
   */
  @Public()
  @Get('file/:filename')
  serve(@Param('filename') filename: string, @Res() res: Response) {
    const path = join(UPLOAD_DIR, filename);
    if (!existsSync(path)) return res.status(404).send('Not found');
    res.sendFile(path);
  }
}

@Module({ providers: [AdjuntosService], controllers: [AdjuntosController], exports: [AdjuntosService] })
export class AdjuntosModule {}
