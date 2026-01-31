import { Injectable } from '@nestjs/common';

/**
 * Placeholder para envío de mensajes por WhatsApp.
 * Por ahora solo imprime el código en consola para pruebas sin gastar en Twilio.
 */
@Injectable()
export class WhatsAppService {
  /**
   * Prepara y "envía" el código de verificación de cuenta.
   * En producción se integraría con Twilio/API de WhatsApp.
   */
  sendVerificationCode(code: string): void {
    const message = `Tu código de verificación es: ${code}`;
    console.log('[WhatsAppService] Mensaje de verificación (placeholder):', message);
  }

  /**
   * Prepara y "envía" el código para restablecer contraseña.
   * Mensaje distinto al de verificación para evitar confusiones.
   * En producción se integraría con Twilio/API de WhatsApp.
   */
  sendResetPasswordCode(code: string): void {
    const message = `Tu código para restablecer tu contraseña es: ${code}`;
    console.log('[WhatsAppService] Mensaje de restablecimiento de contraseña (placeholder):', message);
  }
}
