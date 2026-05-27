import {
  Controller, Get, Injectable, Logger, Module, Param, Post, UploadedFile, UseInterceptors,
  BadRequestException, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import * as crypto from 'crypto';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
const MAX_SIZE_MB = 10;
const SIGNED_URL_TTL_SEC = 3600; // 1 hora

@Injectable()
class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private bucket = process.env.SUPABASE_STORAGE_BUCKET || 'attachments';

  // Llamamos la REST API de Storage directo con fetch (nativo en Node 18+).
  // Evitamos @supabase/supabase-js porque su cliente Realtime requiere
  // WebSocket nativo (Node 22+) y revienta en Node 20 aunque solo usemos Storage.
  // Las keys nuevas sb_secret_ van en el header `apikey` (no son JWT).
  private getConfig(): { baseUrl: string; key: string } {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new BadRequestException(
        'Storage no configurado: faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. ' +
        'Configurar en .env (local) o en Render dashboard → Environment (prod).',
      );
    }
    return { baseUrl: `${url.replace(/\/$/, '')}/storage/v1`, key };
  }

  async upload(buffer: Buffer, path: string, contentType: string) {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Archivo vacío o no recibido correctamente');
    }
    const { baseUrl, key } = this.getConfig();
    try {
      const res = await fetch(`${baseUrl}/object/${this.bucket}/${path}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': contentType,
          'x-upsert': 'false',
        },
        body: buffer,
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Storage upload failed ${res.status} (bucket=${this.bucket}, path=${path}): ${text}`);
        throw new BadRequestException(
          `No se pudo subir el archivo (${res.status}). Verificar que el bucket '${this.bucket}' exista.`,
        );
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`Storage upload exception: ${e?.message || e}`, e?.stack);
      throw new BadRequestException(`Error de Storage: ${e?.message || 'desconocido'}`);
    }
  }

  async signedUrl(path: string): Promise<string> {
    const { baseUrl, key } = this.getConfig();
    try {
      const res = await fetch(`${baseUrl}/object/sign/${this.bucket}/${path}`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SEC }),
      });
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Storage signedUrl failed ${res.status} (path=${path}): ${text}`);
        throw new BadRequestException(`No se pudo generar el enlace (${res.status})`);
      }
      const data = (await res.json()) as { signedURL: string };
      // signedURL es relativo: /object/sign/bucket/path?token=... → anteponer baseUrl
      return `${baseUrl}${data.signedURL}`;
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`Storage signedUrl exception: ${e?.message || e}`);
      throw new BadRequestException(`Error de Storage: ${e?.message || 'desconocido'}`);
    }
  }
}

@Injectable()
class AdjuntosService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  async crear(file: Express.Multer.File, meta: { entidad: string; entidadId?: string }, user: AuthUser) {
    if (!ALLOWED_MIME.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`);
    }
    const id = crypto.randomUUID();
    const ext = extname(file.originalname) || '';
    const storagePath = `${meta.entidad || 'generico'}/${id}${ext}`;

    await this.storage.upload(file.buffer, storagePath, file.mimetype);

    const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');

    return this.prisma.adjunto.create({
      data: {
        nombre: file.originalname,
        mimeType: file.mimetype,
        tamanioBytes: file.size,
        // urlS3 guarda el path de Supabase Storage. El frontend llama a /adjuntos/file/:id y el backend redirige a la signed URL.
        urlS3: storagePath,
        checksumSha256: checksum,
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
  constructor(private svc: AdjuntosService, private storage: StorageService, private prisma: PrismaService) {}

  @Post()
  @ApiOperation({ summary: 'Subir un archivo (foto/pdf) a Supabase Storage' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthUser,
  ) {
    if (!file) throw new BadRequestException('Archivo no enviado');
    const adj = await this.svc.crear(file, { entidad: 'documento_soporte' }, user);
    // Reemplazamos urlS3 en la respuesta por la URL que el front necesita (proxy del backend).
    // El path real en Storage se mantiene en la DB.
    return { ...adj, urlS3: `/adjuntos/file/${adj.id}` };
  }

  /**
   * Sirve el archivo: genera signed URL de Supabase y hace 302 redirect.
   * El archivo va directo Supabase→cliente, sin pasar por el backend (ahorra egress).
   * Público porque el id es UUID no enumerable + la signed URL expira en 1h.
   */
  @Public()
  @Get('file/:id')
  async serve(@Param('id') id: string, @Res() res: Response) {
    const adj = await this.prisma.adjunto.findUnique({ where: { id } });
    if (!adj) return res.status(404).send('Not found');
    const url = await this.storage.signedUrl(adj.urlS3);
    return res.redirect(302, url);
  }
}

@Module({
  providers: [StorageService, AdjuntosService],
  controllers: [AdjuntosController],
  exports: [AdjuntosService, StorageService],
})
export class AdjuntosModule {}
