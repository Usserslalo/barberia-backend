import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { LANDING_CONFIG_ID } from '../landing/constants/landing.constants';

const META_GRAPH_VERSION = 'v21.0';
const META_GRAPH_BASE_URL = 'https://graph.facebook.com';
const TEMPLATE_AUTH_CODE = 'auth_code_barberia_v2';
/** Plantilla Meta: confirmación de cita (parámetros: nombreCliente, barbero, servicio, fechaHora). */
const TEMPLATE_APPOINTMENT_CONFIRMATION = 'appointment_confirmation';
/** Plantilla Meta: recordatorio 24h antes (parámetros: nombreCliente, barbero, servicio, fechaHora). Incluir opción cancelar. */
const TEMPLATE_APPOINTMENT_REMINDER = 'appointment_reminder';
const TEMPLATE_LANGUAGE = 'es';

/**
 * Servicio de envío de mensajes por WhatsApp mediante Meta Cloud API.
 * Obtiene whatsappPhoneId y whatsappWabaId desde LandingConfig (guardados por admin).
 */
@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private readonly accessToken: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly prisma: PrismaService,
  ) {
    this.accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');
  }

  /**
   * Obtiene la configuración de WhatsApp desde LandingConfig.
   */
  private async getWhatsAppConfig(): Promise<{ phoneId: string; wabaId: string | null } | null> {
    const config = await this.prisma.landingConfig.findUnique({
      where: { id: LANDING_CONFIG_ID },
      select: { whatsappPhoneId: true, whatsappWabaId: true },
    });
    if (!config?.whatsappPhoneId) return null;
    return { phoneId: config.whatsappPhoneId, wabaId: config.whatsappWabaId };
  }

  /**
   * Normaliza el teléfono al formato esperado por Meta (sin +).
   */
  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  /**
   * Envía un mensaje de plantilla con parámetros dinámicos.
   */
  private async sendTemplateWithParams(
    phone: string,
    templateName: string,
    bodyParameters: string[],
    language = TEMPLATE_LANGUAGE,
  ): Promise<void> {
    const token = this.accessToken;
    const config = await this.getWhatsAppConfig();

    if (!token) {
      this.logger.warn(
        'WHATSAPP_ACCESS_TOKEN no configurado. No se enviará el mensaje.',
      );
      return;
    }

    if (!config) {
      this.logger.warn(
        'whatsappPhoneId no configurado en LandingConfig (/admin/config). No se enviará el mensaje.',
      );
      return;
    }

    const url = `${META_GRAPH_BASE_URL}/${META_GRAPH_VERSION}/${config.phoneId}/messages`;
    const to = this.normalizePhone(phone);

    const template: { name: string; language: { code: string }; components?: object[] } = {
      name: templateName,
      language: { code: language },
    };

    if (bodyParameters.length > 0) {
      template.components = [
        {
          type: 'body',
          parameters: bodyParameters.map((text) => ({ type: 'text' as const, text })),
        },
      ];
    }

    const body = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template,
    };

    try {
      await firstValueFrom(
        this.httpService.post(url, body, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
      );
      this.logger.log(`WhatsApp enviado correctamente a ${to} (template: ${templateName})`);
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: { message?: string; code?: number } }>;
      this.logger.error('Error al enviar mensaje por Meta WhatsApp API:', {
        status: axiosError.response?.status,
        statusText: axiosError.response?.statusText,
        data: axiosError.response?.data,
        message: axiosError.message,
      });
      if (axiosError.response?.data) {
        this.logger.error('Meta API error.response.data:', JSON.stringify(axiosError.response.data, null, 2));
      }
      throw error;
    }
  }

  /**
   * Envía el código de verificación de cuenta al teléfono indicado.
   * Usa la plantilla auth_code_barberia_v2 aprobada por Meta.
   */
  async sendVerificationCode(phone: string, code: string): Promise<void> {
    this.logger.debug(`Enviando verificación a ${phone} (código: ${code})`);
    await this.sendTemplateWithParams(phone, TEMPLATE_AUTH_CODE, [code]);
  }

  /**
   * Envía el código para restablecer contraseña al teléfono indicado.
   * Usa la misma plantilla auth_code_barberia_v2.
   */
  async sendResetPasswordCode(phone: string, code: string): Promise<void> {
    this.logger.debug(`Enviando reset password a ${phone} (código: ${code})`);
    await this.sendTemplateWithParams(phone, TEMPLATE_AUTH_CODE, [code]);
  }

  /**
   * Envía confirmación inmediata de cita reservada al cliente por WhatsApp.
   * Cargar cita con user (phone), barber (name), service (name, date) y enviar plantilla.
   * Si no hay token/config o falla el envío, se registra y no se relanza (la cita ya está creada).
   */
  async sendConfirmation(appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: { select: { phone: true, firstName: true } },
        barber: { select: { name: true } },
        service: { select: { name: true } },
      },
    });
    if (!appointment?.user?.phone) {
      this.logger.warn(`Cita ${appointmentId} o usuario sin teléfono; no se envía confirmación`);
      return;
    }
    const dateStr = appointment.date.toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const params = [
      appointment.user.firstName ?? 'Cliente',
      appointment.barber.name,
      appointment.service.name,
      dateStr,
    ];
    await this.sendTemplateWithParams(
      appointment.user.phone,
      TEMPLATE_APPOINTMENT_CONFIRMATION,
      params,
    );
  }

  /**
   * Envía recordatorio de cita (24h antes) y opción de cancelación.
   * Marcar appointment.reminderSent = true tras enviar para no duplicar (Cron).
   * Cron Job sugerido: cada hora buscar citas con date entre now+24h y now+25h, reminderSent=false, status=PENDING.
   */
  async sendReminder(appointmentId: string): Promise<void> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        user: { select: { phone: true, firstName: true } },
        barber: { select: { name: true } },
        service: { select: { name: true } },
      },
    });
    if (!appointment?.user?.phone || appointment.reminderSent) {
      return;
    }
    if (appointment.status !== 'PENDING') {
      return;
    }
    const dateStr = appointment.date.toLocaleString('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const params = [
      appointment.user.firstName ?? 'Cliente',
      appointment.barber.name,
      appointment.service.name,
      dateStr,
    ];
    await this.sendTemplateWithParams(
      appointment.user.phone,
      TEMPLATE_APPOINTMENT_REMINDER,
      params,
    );
    await this.prisma.appointment.update({
      where: { id: appointmentId },
      data: { reminderSent: true },
    });
  }
}
