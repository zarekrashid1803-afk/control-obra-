import {
  Controller, Get, Injectable, Logger, Module, Param, Post, UploadedFile, UseInterceptors,
  BadRequestException, Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
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
  private client: SupabaseClient | null = null;
  private bucket = process.env.SUPABASE_STORAGE_BUCKET || 'attachments';

  // Lazy: si faltan vars, no rompe el boot — solo falla cuando alguien intente subir/servir un archivo.
  private getClient(): SupabaseClient {
    if (this.client) return this.client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new BadRequestException(
        'Storage no configurado: faltan SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. ' +
        'Configurar en .env (local) o en Render dashboard → Environment (prod).',
      );
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false },
      // Node 20 no tiene WebSocket nativo (sí Node 22+). supabase-js instancia
      // el cliente Realtime eagerly y revienta sin esto. Solo usamos Storage
      // (HTTP), pero hay que pasar el transport igual.
      realtime: { transport: WebSocket as any },
    });
    return this.client;
  }

  async upload(buffer: Buffer, path: string, contentType: string) {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException('Archivo vacío o no recibido correctamente');
    }
    try {
      const { error } = await this.getClient().storage
        .from(this.bucket)
        .upload(path, buffer, { contentType, upsert: false });
      if (error) {
        this.logger.error(`Supabase upload error (bucket=${this.bucket}, path=${path}): ${error.message}`);
        throw new BadRequestException(`No se pudo subir el archivo: ${error.message}`);
      }
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e;
      this.logger.error(`Storage upload exception: ${e?.message || e}`, e?.stack);
      throw new BadRequestException(
        `Error de Storage: ${e?.message || 'desconocido'}. Verificar que el bucket '${this.bucket}' exista y que SUPABASE_SERVICE_ROLE_KEY sea válida.`,
      );
    }
  }

  async signedUrl(path: string): Promise<string> {
    try {
      const { data, error } = await this.getClient().storage
        .from(this.bucket)
        .createSignedUrl(path, SIGNED_URL_TTL_SEC);
      if (error || !data) {
        this.logger.error(`Supabase signedUrl error (path=${path}): ${error?.message}`);
        throw new BadRequestException(`No se pudo generar el enlace: ${error?.message}`);
      }
      return data.signedUrl;
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
