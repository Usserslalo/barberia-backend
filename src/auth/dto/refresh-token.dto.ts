import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * El refresh token puede enviarse en cookie HttpOnly (recomendado) o en el body.
 * Si se envía en cookie, el body puede estar vacío.
 */
export class RefreshTokenDto {
  @ApiPropertyOptional({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description:
      'Refresh token JWT (opcional si se envía en cookie HttpOnly). Prioridad: cookie > body.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
