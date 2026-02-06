import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateServiceDto {
  @ApiPropertyOptional({
    example: 'Corte de hombre',
    description: 'Nombre del servicio',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    example: 'Corte clásico con tijera y máquina',
    description: 'Descripción del servicio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: 280,
    description: 'Precio en pesos',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiPropertyOptional({
    example: 50,
    description: 'Duración estimada en minutos',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @ApiPropertyOptional({
    example: 'Corte',
    description: 'Categoría legacy (string). Si se envía categoryId, se ignora y se rellena desde la categoría.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @ApiPropertyOptional({
    example: 'uuid-categoria',
    description: 'ID de ServiceCategory. Si se envía, el campo category (string) se rellena con el nombre de la categoría.',
  })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Si el servicio está activo (soft delete)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
