import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { AuthService, AuthResponse } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { MeResponseDto } from './dto/me-response.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyWhatsAppDto } from './dto/verify-whatsapp.dto';
import { ThrottlerLoggingInterceptor } from './interceptors/throttler-logging.interceptor';
import type { JwtValidatedUser } from './strategies/jwt.strategy';

/** Límite estricto anti-fuerza bruta: 5 peticiones por minuto en login, verify-whatsapp, reset-password, resend-otp. */
const STRICT_THROTTLE = { default: { limit: 5, ttl: 60000 } };

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
@UseInterceptors(ThrottlerLoggingInterceptor)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Iniciar sesión',
    description:
      'Valida email y contraseña y devuelve access_token (1h) y refresh_token (7d). Devuelve 401 si las credenciales son inválidas. Rate limit: 5 peticiones/minuto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Login exitoso. Devuelve access_token, refresh_token y datos del usuario.',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        refresh_token: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', example: 'carlos.mendoza@gmail.com' },
            role: { type: 'string', enum: ['ADMIN', 'USER'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Credenciales inválidas, cuenta desactivada o no verificada.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (validación DTO).' })
  @ApiResponse({ status: 429, description: 'Too Many Requests. Límite de 5 peticiones por minuto excedido.' })
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  @Post('register')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registro de usuario',
    description:
      'Crea un nuevo usuario (rol USER por defecto) y envía OTP por WhatsApp. Devuelve 409 si el correo ya está registrado.',
  })
  @ApiResponse({
    status: 201,
    description: 'Registro exitoso. Devuelve access_token, refresh_token y datos del usuario.',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', example: 'usuario@example.com' },
            role: { type: 'string', example: 'USER' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 409, description: 'Ya existe un usuario con este correo electrónico.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (validación DTO).' })
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  @Post('verify-whatsapp')
  @Public()
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar cuenta por WhatsApp',
    description:
      'Recibe el email y el código OTP de 6 dígitos enviado por WhatsApp. Si el código coincide y no ha expirado (10 min), marca isVerified=true y limpia verificationCode. Rate limit: 5 peticiones/minuto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Cuenta verificada correctamente. El usuario ya puede iniciar sesión.',
    schema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'Cuenta verificada correctamente. Ya puede iniciar sesión.' } },
    },
  })
  @ApiResponse({ status: 400, description: 'Código expirado o no hay código pendiente de verificación.' })
  @ApiResponse({ status: 401, description: 'Usuario no encontrado o código incorrecto.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests. Límite de 5 peticiones por minuto excedido.' })
  async verifyWhatsApp(@Body() dto: VerifyWhatsAppDto): Promise<{ message: string }> {
    return this.authService.verifyWhatsApp(dto);
  }

  @Post('forgot-password')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Solicitar recuperación de contraseña',
    description:
      'Envía un código OTP por WhatsApp al correo indicado (si está registrado). Por seguridad siempre devuelve el mismo mensaje genérico para evitar user enumeration. El código expira en 10 minutos. No requiere Bearer Token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Siempre 200 con mensaje genérico (no revela si el email existe).',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Si el correo está registrado, recibirá un código por WhatsApp en breve.',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Datos de entrada inválidos (validación DTO).',
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @Public()
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Restablecer contraseña con código OTP',
    description:
      'Recibe email, código de 6 dígitos (enviado por WhatsApp) y nueva contraseña. Valida que el código no haya expirado y coincida; luego actualiza la contraseña y limpia los campos de restablecimiento. Rate limit: 5 peticiones/minuto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña restablecida correctamente. El usuario ya puede iniciar sesión.',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', example: 'Contraseña restablecida correctamente. Ya puede iniciar sesión.' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Código expirado, no hay código pendiente o datos inválidos (ej. contraseña no cumple requisitos).',
  })
  @ApiResponse({ status: 401, description: 'Código de restablecimiento incorrecto.' })
  @ApiResponse({ status: 429, description: 'Too Many Requests. Límite de 5 peticiones por minuto excedido.' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<{ message: string }> {
    return this.authService.resetPassword(dto);
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refrescar tokens (Token Rotation)',
    description:
      'Recibe el refresh_token, lo valida y compara con el jti persistido en BD. Emite un nuevo par access_token (1h) y refresh_token (7d). Invalida el refresh anterior. No requiere Bearer Token.',
  })
  @ApiResponse({
    status: 200,
    description: 'Nuevo par de tokens emitido.',
    schema: {
      type: 'object',
      properties: {
        access_token: { type: 'string' },
        refresh_token: { type: 'string' },
        user: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string' },
            role: { type: 'string', enum: ['ADMIN', 'USER'] },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Refresh token inválido, expirado o ya utilizado.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (validación DTO).' })
  async refresh(@Body() dto: RefreshTokenDto): Promise<AuthResponse> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('resend-otp')
  @Public()
  @Throttle(STRICT_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reenviar código OTP de verificación',
    description:
      'Recibe email. Genera un nuevo verificationCode, actualiza la expiración (10 min) y envía por WhatsApp. Siempre devuelve mensaje genérico para evitar user enumeration. Rate limit: 5 peticiones/minuto.',
  })
  @ApiResponse({
    status: 200,
    description: 'Mensaje genérico (no revela si el email existe o si se reenvió el código).',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example: 'Si el correo está registrado y tiene un código pendiente, recibirá uno nuevo por WhatsApp.',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (validación DTO).' })
  @ApiResponse({ status: 429, description: 'Too Many Requests. Límite de 5 peticiones por minuto excedido.' })
  async resendOtp(@Body() dto: ResendOtpDto): Promise<{ message: string }> {
    return this.authService.resendOtp(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Cerrar sesión',
    description: 'Limpia el refreshToken del usuario en BD. Requiere Bearer Token. Invalida la sesión para rotación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sesión cerrada correctamente.',
    schema: { type: 'object', properties: { message: { type: 'string', example: 'Sesión cerrada correctamente.' } } },
  })
  @ApiResponse({ status: 401, description: 'Token inválido o expirado.' })
  async logout(@CurrentUser() user: JwtValidatedUser): Promise<{ message: string }> {
    return this.authService.logout(user.userId);
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Cambiar contraseña',
    description:
      'Valida la contraseña actual antes de permitir el cambio. Requiere Bearer Token. Invalida refresh tokens (debe iniciar sesión de nuevo).',
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada correctamente.',
    schema: {
      type: 'object',
      properties: { message: { type: 'string', example: 'Contraseña actualizada correctamente. Inicie sesión de nuevo.' } },
    },
  })
  @ApiResponse({ status: 401, description: 'Token inválido o contraseña actual incorrecta.' })
  @ApiResponse({ status: 400, description: 'Datos de entrada inválidos (validación DTO, ej. nueva contraseña no cumple requisitos).' })
  async changePassword(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    return this.authService.changePassword(user.userId, dto);
  }

  @Get('me')
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Perfil del usuario actual',
    description:
      'Devuelve el perfil del usuario autenticado (id, email, role, isVerified). Requiere Bearer Token. Nunca expone el campo password.',
  })
  @ApiResponse({
    status: 200,
    description: 'Perfil del usuario actual.',
    type: MeResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Token inválido, expirado o usuario inactivo.',
  })
  async getMe(@CurrentUser() user: JwtValidatedUser): Promise<MeResponseDto> {
    return this.authService.getProfile(user.userId);
  }
}
