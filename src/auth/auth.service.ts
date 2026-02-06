import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { ROLES } from './constants/roles';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyWhatsAppDto } from './dto/verify-whatsapp.dto';

const SALT_ROUNDS = 10;
const VERIFICATION_EXPIRES_MINUTES = 10;
const RESET_PASSWORD_EXPIRES_MINUTES = 10;
const OTP_LENGTH = 6;
const ACCESS_TOKEN_EXPIRES_SEC = 3600; // 1h
const REFRESH_TOKEN_EXPIRES_SEC = 604800; // 7d

/** Mensaje genérico para evitar user enumeration en recuperación de contraseña. */
const FORGOT_PASSWORD_RESPONSE_MESSAGE =
  'Si el correo está registrado, recibirá un código por WhatsApp en breve.';

/** Mensaje genérico para resend OTP (evitar user enumeration). */
const RESEND_OTP_RESPONSE_MESSAGE =
  'Si el correo está registrado y tiene un código pendiente, recibirá uno nuevo por WhatsApp.';

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface RefreshTokenPayload extends JwtPayload {
  jti: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    role: Role;
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  /**
   * Sanitiza y normaliza un email (lowercase, trim).
   */
  private sanitizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /**
   * Valida que un string sea un UUID válido (formato estándar 8-4-4-4-12).
   * Acepta cualquier variante (v4, nil, o IDs fijos usados en seeds) para no rechazar
   * IDs generados por Prisma o usados en datos de prueba.
   */
  private validateUUID(id: string, fieldName: string): void {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
      this.logger.warn(`UUID inválido recibido en ${fieldName}: ${id}`);
      throw new BadRequestException(`${fieldName} inválido`);
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const sanitizedEmail = this.sanitizeEmail(dto.email);

    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          password: true,
          isActive: true,
          isVerified: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error en login al buscar usuario: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al procesar la solicitud');
    }

    if (!user) {
      // Delay para evitar timing attacks
      await new Promise((resolve) => setTimeout(resolve, 100));
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    // bcrypt.compare puede lanzar excepción si el hash está corrupto
    let isPasswordValid = false;
    try {
      isPasswordValid = await bcrypt.compare(dto.password, user.password);
    } catch (error) {
      this.logger.error(`Error en bcrypt.compare para usuario ${user.id}: ${error.message}`);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException(
        'Debe verificar su cuenta antes de iniciar sesión. Revise su WhatsApp para el código.',
      );
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  /**
   * Emite access_token (1h) y refresh_token (7d con jti); persiste jti en User para rotación.
   */
  private async issueTokenPair(
    userId: string,
    email: string,
    role: Role,
  ): Promise<{ access_token: string; refresh_token: string }> {
    const payload: JwtPayload = { sub: userId, email, role };
    const jti = randomUUID();
    const refreshPayload: RefreshTokenPayload = { ...payload, jti };

    let access_token: string;
    let refresh_token: string;

    try {
      access_token = this.jwtService.sign(payload, {
        expiresIn: ACCESS_TOKEN_EXPIRES_SEC,
      });
      refresh_token = this.jwtService.sign(refreshPayload, {
        expiresIn: REFRESH_TOKEN_EXPIRES_SEC,
      });
    } catch (error) {
      this.logger.error(`Error al firmar tokens para usuario ${userId}: ${error.message}`);
      throw new InternalServerErrorException('Error al generar tokens de autenticación');
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: jti },
      });
    } catch (error) {
      this.logger.error(`Error al persistir refreshToken para usuario ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al completar la autenticación');
    }

    return { access_token, refresh_token };
  }

  /**
   * Refresh tokens (Token Rotation): valida refresh_token, compara jti con BD, emite nuevo par.
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
      throw new UnauthorizedException('Refresh token inválido');
    }

    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    } catch (error) {
      this.logger.warn(`Refresh token inválido o expirado: ${error.message}`);
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const { sub, jti } = payload;

    if (!sub || !jti) {
      this.logger.warn('Refresh token sin sub o jti');
      throw new UnauthorizedException('Refresh token inválido');
    }

    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          refreshToken: true,
          isActive: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error al buscar usuario en refreshTokens: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al procesar la solicitud');
    }

    if (!user) {
      throw new UnauthorizedException('Refresh token inválido o ya utilizado');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    if (!user.refreshToken || user.refreshToken !== jti) {
      this.logger.warn(`Intento de reutilización de refresh token para usuario ${user.id}`);
      throw new UnauthorizedException('Refresh token inválido o ya utilizado');
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  /**
   * Logout: limpia refreshToken del usuario en BD (invalida sesión para rotación).
   */
  async logout(userId: string): Promise<{ message: string }> {
    this.validateUUID(userId, 'userId');

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });
    } catch (error) {
      this.logger.error(`Error al hacer logout para usuario ${userId}: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al cerrar sesión');
    }

    return { message: 'Sesión cerrada correctamente.' };
  }

  /**
   * Cambio de contraseña (protegido por JWT). Valida contraseña actual; invalida refresh tokens.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    this.validateUUID(userId, 'userId');

    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, password: true },
      });
    } catch (error) {
      this.logger.error(`Error al buscar usuario en changePassword: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al procesar la solicitud');
    }

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    let isCurrentValid = false;
    try {
      isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password);
    } catch (error) {
      this.logger.error(`Error en bcrypt.compare en changePassword: ${error.message}`);
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    if (!isCurrentValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    } catch (error) {
      this.logger.error(`Error al hashear nueva contraseña: ${error.message}`);
      throw new InternalServerErrorException('Error al actualizar contraseña');
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword, refreshToken: null },
      });
    } catch (error) {
      this.logger.error(`Error al actualizar contraseña en BD: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al actualizar contraseña');
    }

    return { message: 'Contraseña actualizada correctamente. Inicie sesión de nuevo.' };
  }

  /**
   * Reenvío de OTP de verificación. Mensaje genérico para evitar user enumeration.
   */
  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const sanitizedEmail = this.sanitizeEmail(dto.email);

    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail },
      });
    } catch (error) {
      this.logger.error(`Error en resendOtp al buscar usuario: ${error.message}`, error.stack);
      // Devolver mensaje genérico para no revelar el error
      return { message: RESEND_OTP_RESPONSE_MESSAGE };
    }

    if (!user) {
      // Delay para evitar timing attacks
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { message: RESEND_OTP_RESPONSE_MESSAGE };
    }

    const verificationCode = this.generateOtp();
    const verificationExpires = new Date(
      Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000,
    );

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { verificationCode, verificationExpires },
      });
    } catch (error) {
      this.logger.error(`Error al actualizar código de verificación: ${error.message}`, error.stack);
      return { message: RESEND_OTP_RESPONSE_MESSAGE };
    }

    try {
      await this.whatsAppService.sendVerificationCode(user.phone, verificationCode);
    } catch (error) {
      this.logger.error(`Error al enviar código de verificación por WhatsApp: ${error.message}`);
      // No lanzar error, devolver mensaje genérico
    }

    return { message: RESEND_OTP_RESPONSE_MESSAGE };
  }

  /**
   * Registro: crea un User básico (rol USER por defecto) y envía OTP por WhatsApp.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const sanitizedEmail = this.sanitizeEmail(dto.email);

    let existing;
    try {
      existing = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail },
      });
    } catch (error) {
      this.logger.error(`Error al verificar email existente en register: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al procesar el registro');
    }

    if (existing) {
      throw new ConflictException(
        'Ya existe un usuario registrado con este correo electrónico',
      );
    }

    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);
    } catch (error) {
      this.logger.error(`Error al hashear contraseña en register: ${error.message}`);
      throw new InternalServerErrorException('Error al procesar el registro');
    }

    const verificationCode = this.generateOtp();
    const verificationExpires = new Date(
      Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000,
    );

    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email: sanitizedEmail,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          role: ROLES.USER,
          isVerified: false,
          verificationCode,
          verificationExpires,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error al crear usuario en BD: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al crear la cuenta');
    }

    try {
      await this.whatsAppService.sendVerificationCode(user.phone, verificationCode);
    } catch (error) {
      this.logger.error(`Error al enviar código de verificación por WhatsApp: ${error.message}`);
      // No lanzar error; el usuario ya fue creado y puede usar resend-otp
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
      },
    };
  }

  /**
   * Genera un OTP numérico de 6 dígitos.
   */
  private generateOtp(): string {
    const min = 10 ** (OTP_LENGTH - 1);
    const max = 10 ** OTP_LENGTH - 1;
    const code = Math.floor(min + Math.random() * (max - min + 1)).toString();
    return code;
  }

  /**
   * Solicitud de recuperación de contraseña.
   * Siempre devuelve el mismo mensaje genérico (exista o no el usuario) para evitar user enumeration.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const sanitizedEmail = this.sanitizeEmail(dto.email);

    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail },
      });
    } catch (error) {
      this.logger.error(`Error en forgotPassword al buscar usuario: ${error.message}`, error.stack);
      return { message: FORGOT_PASSWORD_RESPONSE_MESSAGE };
    }

    if (!user) {
      // Delay para evitar timing attacks
      await new Promise((resolve) => setTimeout(resolve, 100));
      return { message: FORGOT_PASSWORD_RESPONSE_MESSAGE };
    }

    const resetPasswordCode = this.generateOtp();
    const resetPasswordExpires = new Date(
      Date.now() + RESET_PASSWORD_EXPIRES_MINUTES * 60 * 1000,
    );

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordCode,
          resetPasswordExpires,
        },
      });
    } catch (error) {
      this.logger.error(`Error al actualizar código de reset: ${error.message}`, error.stack);
      return { message: FORGOT_PASSWORD_RESPONSE_MESSAGE };
    }

    try {
      await this.whatsAppService.sendResetPasswordCode(user.phone, resetPasswordCode);
    } catch (error) {
      this.logger.error(`Error al enviar código de reset por WhatsApp: ${error.message}`);
      // No lanzar error, devolver mensaje genérico
    }

    return { message: FORGOT_PASSWORD_RESPONSE_MESSAGE };
  }

  /**
   * Restablece la contraseña con el código OTP recibido por WhatsApp.
   * Usa campos resetPasswordCode/resetPasswordExpires (independientes del flujo de verificación).
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const sanitizedEmail = this.sanitizeEmail(dto.email);

    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail },
      });
    } catch (error) {
      this.logger.error(`Error en resetPassword al buscar usuario: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al procesar la solicitud');
    }

    if (!user) {
      throw new BadRequestException('Código inválido o expirado. Solicite uno nuevo.');
    }

    if (!user.resetPasswordCode || !user.resetPasswordExpires) {
      throw new BadRequestException(
        'No hay código de restablecimiento pendiente. Solicite uno nuevo.',
      );
    }

    if (user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('El código ha expirado. Solicite uno nuevo.');
    }

    if (user.resetPasswordCode !== dto.code) {
      throw new UnauthorizedException('Código de restablecimiento incorrecto');
    }

    let hashedPassword: string;
    try {
      hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);
    } catch (error) {
      this.logger.error(`Error al hashear nueva contraseña en resetPassword: ${error.message}`);
      throw new InternalServerErrorException('Error al restablecer contraseña');
    }

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetPasswordCode: null,
          resetPasswordExpires: null,
        },
      });
    } catch (error) {
      this.logger.error(`Error al actualizar contraseña en resetPassword: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al restablecer contraseña');
    }

    return { message: 'Contraseña restablecida correctamente. Ya puede iniciar sesión.' };
  }

  /**
   * Verifica el código WhatsApp y marca la cuenta como verificada.
   */
  async verifyWhatsApp(dto: VerifyWhatsAppDto): Promise<{ message: string }> {
    const sanitizedEmail = this.sanitizeEmail(dto.email);

    let user;
    try {
      user = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail },
      });
    } catch (error) {
      this.logger.error(`Error en verifyWhatsApp al buscar usuario: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al procesar la solicitud');
    }

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    if (!user.verificationCode || !user.verificationExpires) {
      throw new BadRequestException(
        'No hay código pendiente de verificación. Solicite uno nuevo registrándose.',
      );
    }

    if (user.verificationExpires < new Date()) {
      throw new BadRequestException('El código ha expirado. Solicite uno nuevo.');
    }

    if (user.verificationCode !== dto.code) {
      throw new UnauthorizedException('Código de verificación incorrecto');
    }

    try {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          isVerified: true,
          verificationCode: null,
          verificationExpires: null,
        },
      });
    } catch (error) {
      this.logger.error(`Error al marcar usuario como verificado: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al verificar la cuenta');
    }

    return { message: 'Cuenta verificada correctamente. Ya puede iniciar sesión.' };
  }

  /**
   * Valida que el usuario exista, esté activo y verificado (útil para JwtStrategy).
   */
  async validateUserById(userId: string) {
    if (!userId || typeof userId !== 'string') {
      this.logger.warn('validateUserById llamado con userId inválido');
      return null;
    }

    try {
      return await this.prisma.user.findFirst({
        where: {
          id: userId,
          isActive: true,
          isVerified: true,
        },
        select: {
          id: true,
          email: true,
          role: true,
          barberId: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error en validateUserById: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Obtiene el perfil del usuario autenticado (id, email, role, isVerified). Nunca devuelve password.
   */
  async getProfile(userId: string) {
    this.validateUUID(userId, 'userId');

    let user;
    try {
      user = await this.prisma.user.findFirst({
        where: {
          id: userId,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          role: true,
          isVerified: true,
          barberId: true,
        },
      });
    } catch (error) {
      this.logger.error(`Error en getProfile al buscar usuario: ${error.message}`, error.stack);
      throw new InternalServerErrorException('Error al obtener el perfil');
    }

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isVerified: user.isVerified,
      ...(user.barberId != null && { barberId: user.barberId }),
    };
  }
}
