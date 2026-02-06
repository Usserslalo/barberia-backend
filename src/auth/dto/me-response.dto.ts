import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

  @ApiProperty({ example: 'Juan', description: 'Nombre del usuario', nullable: true })
  firstName: string | null;

  @ApiProperty({ example: 'Pérez', description: 'Apellido del usuario', nullable: true })
  lastName: string | null;

  @ApiProperty({ example: '+34912345678', description: 'Teléfono del usuario', nullable: true })
  phone: string | null;

  @ApiProperty({ enum: ['ADMIN', 'USER', 'BARBER'], description: 'Rol del usuario' })
  role: Role;

  @ApiProperty({
    description: 'Si la cuenta fue verificada por WhatsApp (OTP)',
    example: true,
  })
  isVerified: boolean;

  @ApiPropertyOptional({
    description: 'ID del perfil Barber vinculado. Solo presente cuando el usuario tiene rol BARBER.',
    example: 'uuid-barber',
  })
  barberId?: string;
}
