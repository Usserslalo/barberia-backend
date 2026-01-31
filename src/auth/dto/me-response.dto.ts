import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

/**
 * Respuesta del endpoint GET /auth/me.
 * Nunca incluye password.
 */
export class MeResponseDto {
  @ApiProperty({ example: 'uuid', description: 'ID del usuario' })
  id: string;

  @ApiProperty({ example: 'usuario@ejemplo.com', description: 'Email del usuario' })
  email: string;

  @ApiProperty({ enum: ['ADMIN', 'USER'], description: 'Rol del usuario' })
  role: Role;

  @ApiProperty({
    description: 'Si la cuenta fue verificada por WhatsApp (OTP)',
    example: true,
  })
  isVerified: boolean;
}
