import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateServiceDto {
  @ApiProperty({
    example: 'Corte de hombre',
    description: 'Nombre del servicio',
  })
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    example: 'Corte clásico con tijera y máquina',
    description: 'Descripción del servicio',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    example: 250,
    description: 'Precio en pesos',
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @ApiProperty({
    example: 45,
    description: 'Duración estimada en minutos',
  })
  @IsInt()
  @Min(1)
  durationMinutes: number;

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
    description: 'Si el servicio está activo',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
