import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateServiceCategoryDto {
  @ApiProperty({ example: 'Corte', description: 'Nombre de la categoría' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: 'corte', description: 'Slug único (URL-friendly)' })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/^[a-z0-9-]+$/, { message: 'El slug solo puede contener minúsculas, números y guiones' })
  slug: string;

  @ApiPropertyOptional({ example: '#3B82F6', description: 'Color en hex para UI' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
