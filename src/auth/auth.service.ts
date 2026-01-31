import {
  BadRequestException,
  ConflictException,
  Injectable,
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
    role: Role;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly whatsAppService: WhatsAppService,
  ) {}

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
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

    const access_token = this.jwtService.sign(payload, {
      expiresIn: ACCESS_TOKEN_EXPIRES_SEC,
    });
    const refresh_token = this.jwtService.sign(refreshPayload, {
      expiresIn: REFRESH_TOKEN_EXPIRES_SEC,
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: jti },
    });

    return { access_token, refresh_token };
  }

  /**
   * Refresh tokens (Token Rotation): valida refresh_token, compara jti con BD, emite nuevo par.
   */
  async refreshTokens(refreshToken: string): Promise<AuthResponse> {
    let payload: RefreshTokenPayload;
    try {
      payload = this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }

    const { sub, jti } = payload;
    const user = await this.prisma.user.findUnique({
      where: { id: sub },
      select: { id: true, email: true, role: true, refreshToken: true, isActive: true },
    });

    if (!user || !user.isActive || user.refreshToken !== jti) {
      throw new UnauthorizedException('Refresh token inválido o ya utilizado');
    }

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  /**
   * Logout: limpia refreshToken del usuario en BD (invalida sesión para rotación).
   */
  async logout(userId: string): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    return { message: 'Sesión cerrada correctamente.' };
  }

  /**
   * Cambio de contraseña (protegido por JWT). Valida contraseña actual; invalida refresh tokens.
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const isCurrentValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isCurrentValid) {
      throw new UnauthorizedException('Contraseña actual incorrecta');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword, refreshToken: null },
    });

    return { message: 'Contraseña actualizada correctamente. Inicie sesión de nuevo.' };
  }

  /**
   * Reenvío de OTP de verificación. Mensaje genérico para evitar user enumeration.
   */
  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return { message: RESEND_OTP_RESPONSE_MESSAGE };
    }

    const verificationCode = this.generateOtp();
    const verificationExpires = new Date(
      Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: { verificationCode, verificationExpires },
    });

    this.whatsAppService.sendVerificationCode(verificationCode);

    return { message: RESEND_OTP_RESPONSE_MESSAGE };
  }

  /**
   * Registro: crea un User básico (rol USER por defecto) y envía OTP por WhatsApp.
   */
  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(
        'Ya existe un usuario registrado con este correo electrónico',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const verificationCode = this.generateOtp();
    const verificationExpires = new Date(
      Date.now() + VERIFICATION_EXPIRES_MINUTES * 60 * 1000,
    );

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        role: ROLES.USER,
        isVerified: false,
        verificationCode,
        verificationExpires,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    this.whatsAppService.sendVerificationCode(verificationCode);

    const tokens = await this.issueTokenPair(user.id, user.email, user.role);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
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
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      return { message: FORGOT_PASSWORD_RESPONSE_MESSAGE };
    }

    const resetPasswordCode = this.generateOtp();
    const resetPasswordExpires = new Date(
      Date.now() + RESET_PASSWORD_EXPIRES_MINUTES * 60 * 1000,
    );

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordCode,
        resetPasswordExpires,
      },
    });

    this.whatsAppService.sendResetPasswordCode(resetPasswordCode);

    return { message: FORGOT_PASSWORD_RESPONSE_MESSAGE };
  }

  /**
   * Restablece la contraseña con el código OTP recibido por WhatsApp.
   * Usa campos resetPasswordCode/resetPasswordExpires (independientes del flujo de verificación).
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

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

    const hashedPassword = await bcrypt.hash(dto.newPassword, SALT_ROUNDS);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordCode: null,
        resetPasswordExpires: null,
      },
    });

    return { message: 'Contraseña restablecida correctamente. Ya puede iniciar sesión.' };
  }

  /**
   * Verifica el código WhatsApp y marca la cuenta como verificada.
   */
  async verifyWhatsApp(dto: VerifyWhatsAppDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

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

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationCode: null,
        verificationExpires: null,
      },
    });

    return { message: 'Cuenta verificada correctamente. Ya puede iniciar sesión.' };
  }

  /**
   * Valida que el usuario exista, esté activo y verificado (útil para JwtStrategy).
   */
  async validateUserById(userId: string) {
    return this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
        isVerified: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });
  }

  /**
   * Obtiene el perfil del usuario autenticado (id, email, role, isVerified). Nunca devuelve password.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        role: true,
        isVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o inactivo');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
    };
  }
}
