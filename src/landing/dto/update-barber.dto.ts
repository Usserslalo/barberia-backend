import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsAllowedImageUrl } from '../validators/allowed-image-url.validator';

export class UpdateBarberDto {
  @ApiPropertyOptional({
    example: 'Sergey Trifonov',
    description: 'Nombre completo del barbero',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    example: 'Top Barber Stylist',
    description: 'Cargo o especialidad del barbero',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  roleDescription?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/barber.jpg',
    description: 'URL de la foto del barbero',
  })
  @IsOptional()
  @IsUrl({}, { message: 'photoUrl debe ser una URL válida' })
  @IsAllowedImageUrl()
  photoUrl?: string;

  @ApiPropertyOptional({
    example: 7,
    description: 'Años de experiencia',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @ApiPropertyOptional({
    example: 'Especialista en cortes clásicos y barbas.',
    description: 'Biografía corta para el landing',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Orden de aparición en landing (menor = primero)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({
    example: true,
    description: 'Si el barbero está activo (soft delete)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
