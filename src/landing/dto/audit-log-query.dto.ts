import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, IsString, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query params para GET /api/landing/admin/audit-logs.
 */
export class AuditLogQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Página (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Tamaño de página (1-100)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    example: 'Barber',
    description: 'Filtrar por entidad: LandingConfig, Barber, Service, GalleryItem',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  entity?: string;

  @ApiPropertyOptional({
    example: 'uuid-admin',
    description: 'Filtrar por ID del usuario (admin) que realizó la acción',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  adminId?: string;
}
