import { Injectable, Logger, Module } from '@nestjs/common';
import { Resend } from 'resend';
import { PrismaService } from '../prisma/prisma.service';

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://control-obra-web.vercel.app';
const EMAIL_FROM = process.env.EMAIL_FROM || 'Control de Obra <onboarding@resend.dev>';

// ============================================================
// EmailService — envío de emails via Resend.
// Si no hay RESEND_API_KEY, loguea y no manda nada (no rompe la app).
// ============================================================
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend | null = null;

  private getClient(): Resend | null {
    if (this.resend) return this.resend;
    const key = process.env.RESEND_API_KEY;
    if (!key) return null;
    this.resend = new Resend(key);
    return this.resend;
  }

  /**
   * Envía un email. Fire-and-forget desde el caller.
   * Si falla o no hay key, loguea y devuelve sin throw.
   */
  async send(opts: {
    to: string | string[];
    subject: string;
    html: string;
    attachments?: { filename: string; content: Buffer }[];
  }): Promise<boolean> {
    const client = this.getClient();
    if (!client) {
      this.logger.warn(`[email skipped — sin RESEND_API_KEY] To: ${opts.to} · Subject: ${opts.subject}`);
      return false;
    }
    try {
      const { error } = await client.emails.send({
        from: EMAIL_FROM,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
      });
      if (error) {
        this.logger.error(`Resend error: ${error.message}`);
        return false;
      }
      return true;
    } catch (e: any) {
      this.logger.error(`Email failed: ${e?.message || e}`);
      return false;
    }
  }
}

// ============================================================
// NotificationsService — orquesta notificaciones de eventos del negocio.
// In-app (tabla notificacion) + email.
// ============================================================
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService, private email: EmailService) {}

  /**
   * Notifica que una requisición está pendiente de avalar/aprobar.
   * Manda email a directores y admins del tenant + crea notif in-app.
   * Es fire-and-forget — si falla algo, loguea pero no propaga el error.
   */
  async notificarRequisicionPendiente(args: {
    requisicionId: string;
    codigo: string;
    descripcion: string;
    montoCentavos: bigint | string;
    tenantId: number;
    solicitanteNombre: string;
    frenteNombre?: string;
  }): Promise<void> {
    try {
      // Encontrar a quién notificar: directores + admins activos del tenant
      const destinatarios = await this.prisma.usuario.findMany({
        where: {
          tenantId: args.tenantId,
          activo: true,
          deletedAt: null,
          roles: { some: { rolId: { in: ['director', 'admin'] } } },
        },
        select: { id: true, email: true, nombres: true },
      });

      if (destinatarios.length === 0) {
        this.logger.warn(`Sin directores/admins en tenant ${args.tenantId} para notificar requisición ${args.codigo}`);
        return;
      }

      const monto = Number(args.montoCentavos) / 100;
      const montoFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(monto);
      const link = `${FRONTEND_URL}/requisiciones/${args.requisicionId}`;

      // 1) Notif in-app — una por destinatario
      await this.prisma.notificacion.createMany({
        data: destinatarios.map((d) => ({
          targetUserId: d.id,
          tipo: 'aprob',
          texto: `Requisición ${args.codigo} pendiente · ${montoFmt}`,
          payload: { requisicionId: args.requisicionId, codigo: args.codigo },
        })),
      });

      // 2) Email — uno por destinatario (Resend acepta array pero queremos personalizar saludo)
      for (const d of destinatarios) {
        this.email.send({
          to: d.email,
          subject: `[Control de Obra] Requisición pendiente: ${args.codigo}`,
          html: this.tplPendiente({
            nombre: d.nombres,
            codigo: args.codigo,
            descripcion: args.descripcion,
            montoFmt,
            solicitante: args.solicitanteNombre,
            frente: args.frenteNombre,
            link,
          }),
        }).catch(() => {}); // fire-and-forget
      }
    } catch (e: any) {
      this.logger.error(`notificarRequisicionPendiente falló: ${e?.message || e}`);
    }
  }

  /**
   * Notifica al solicitante que su requisición fue aprobada o rechazada.
   */
  async notificarRequisicionResuelta(args: {
    requisicionId: string;
    codigo: string;
    estado: 'aprobada' | 'rechazada';
    motivo?: string;
    solicitanteId: string;
  }): Promise<void> {
    try {
      const solicitante = await this.prisma.usuario.findUnique({
        where: { id: args.solicitanteId },
        select: { email: true, nombres: true },
      });
      if (!solicitante) return;

      // In-app
      await this.prisma.notificacion.create({
        data: {
          targetUserId: args.solicitanteId,
          tipo: args.estado === 'aprobada' ? 'aprob_ok' : 'aprob_rechazo',
          texto:
            args.estado === 'aprobada'
              ? `Tu requisición ${args.codigo} fue aprobada ✓`
              : `Tu requisición ${args.codigo} fue rechazada · ${args.motivo || 'Sin motivo'}`,
          payload: { requisicionId: args.requisicionId, codigo: args.codigo },
        },
      });

      // Email
      const link = `${FRONTEND_URL}/requisiciones/${args.requisicionId}`;
      const ok = args.estado === 'aprobada';
      this.email.send({
        to: solicitante.email,
        subject: `[Control de Obra] Tu requisición ${args.codigo} fue ${ok ? 'aprobada ✓' : 'rechazada'}`,
        html: this.tplResuelta({
          nombre: solicitante.nombres,
          codigo: args.codigo,
          ok,
          motivo: args.motivo,
          link,
        }),
      }).catch(() => {});
    } catch (e: any) {
      this.logger.error(`notificarRequisicionResuelta falló: ${e?.message || e}`);
    }
  }

  /** Email con el enlace para restablecer la contraseña. */
  async enviarResetPassword(email: string, nombre: string, link: string): Promise<void> {
    await this.email
      .send({
        to: email,
        subject: '[Control de Obra] Restablece tu contraseña',
        html: this.tplResetPassword({ nombre, link }),
      })
      .catch(() => {});
  }

  // ============================================================
  // Templates HTML — minimalistas, inline styles para max compatibilidad
  // ============================================================
  private tplResetPassword(d: { nombre: string; link: string }): string {
    return `
<div style="font-family:Inter,Arial,sans-serif;background:#f5f6f7;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#000;color:#fff;padding:20px 24px;">
      <div style="font-size:11px;letter-spacing:2px;opacity:0.7;">CONTROL DE OBRA</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px;">Restablece tu contraseña</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px 0;">Hola ${this.escape(d.nombre)},</p>
      <p style="margin:0 0 16px 0;">Recibimos una solicitud para restablecer tu contraseña. Haz clic en el botón para crear una nueva. El enlace expira en <strong>1 hora</strong>.</p>
      <div style="margin-top:24px;">
        <a href="${d.link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Restablecer contraseña →</a>
      </div>
      <p style="margin:24px 0 0 0;font-size:12px;color:#686B6C;">Si no solicitaste esto, ignora este correo: tu contraseña no cambiará.</p>
    </div>
    <div style="padding:16px 24px;background:#f5f6f7;font-size:11px;color:#686B6C;text-align:center;">
      Project by Orion · No respondas a este email.
    </div>
  </div>
</div>`;
  }

  private tplPendiente(d: {
    nombre: string; codigo: string; descripcion: string; montoFmt: string;
    solicitante: string; frente?: string; link: string;
  }): string {
    return `
<div style="font-family:Inter,Arial,sans-serif;background:#f5f6f7;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#000;color:#fff;padding:20px 24px;">
      <div style="font-size:11px;letter-spacing:2px;opacity:0.7;">CONTROL DE OBRA</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px;">Requisición pendiente de tu aprobación</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px 0;">Hola ${d.nombre},</p>
      <p style="margin:0 0 16px 0;">${d.solicitante} creó una nueva requisición que requiere tu atención:</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:8px 0;color:#686B6C;width:35%;">Código</td><td style="padding:8px 0;font-weight:600;font-family:monospace;">${d.codigo}</td></tr>
        ${d.frente ? `<tr><td style="padding:8px 0;color:#686B6C;">Frente</td><td style="padding:8px 0;">${d.frente}</td></tr>` : ''}
        <tr><td style="padding:8px 0;color:#686B6C;">Descripción</td><td style="padding:8px 0;">${this.escape(d.descripcion)}</td></tr>
        <tr><td style="padding:8px 0;color:#686B6C;">Monto</td><td style="padding:8px 0;font-weight:700;">${d.montoFmt}</td></tr>
      </table>
      <div style="margin-top:24px;">
        <a href="${d.link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Revisar requisición →</a>
      </div>
    </div>
    <div style="padding:16px 24px;background:#f5f6f7;font-size:11px;color:#686B6C;text-align:center;">
      Project by Orion · No respondas a este email, fue enviado por el sistema.
    </div>
  </div>
</div>`;
  }

  private tplResuelta(d: { nombre: string; codigo: string; ok: boolean; motivo?: string; link: string }): string {
    const color = d.ok ? '#059669' : '#dc2626';
    const status = d.ok ? 'aprobada ✓' : 'rechazada';
    return `
<div style="font-family:Inter,Arial,sans-serif;background:#f5f6f7;padding:24px;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
    <div style="background:#000;color:#fff;padding:20px 24px;">
      <div style="font-size:11px;letter-spacing:2px;opacity:0.7;">CONTROL DE OBRA</div>
      <div style="font-size:18px;font-weight:700;margin-top:4px;">Tu requisición fue ${status}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px 0;">Hola ${d.nombre},</p>
      <p style="margin:0 0 16px 0;">
        Tu requisición <strong style="font-family:monospace;">${d.codigo}</strong> fue
        <strong style="color:${color};">${status}</strong>.
      </p>
      ${d.motivo ? `<div style="background:#f5f6f7;padding:12px;border-radius:6px;margin:16px 0;font-size:13px;"><strong>Motivo:</strong> ${this.escape(d.motivo)}</div>` : ''}
      <div style="margin-top:24px;">
        <a href="${d.link}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;font-weight:600;">Ver detalle →</a>
      </div>
    </div>
    <div style="padding:16px 24px;background:#f5f6f7;font-size:11px;color:#686B6C;text-align:center;">
      Project by Orion · No respondas a este email.
    </div>
  </div>
</div>`;
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

@Module({
  providers: [EmailService, NotificationsService],
  exports: [EmailService, NotificationsService],
})
export class NotificationsModule {}
