import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateBarberWorkScheduleDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 6 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({ example: '09:00', description: 'HH:mm con cero a la izquierda' })
  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime debe ser HH:mm (24h) con cero a la izquierda, ej. 09:00',
  })
  @MaxLength(5)
  startTime?: string;

  @ApiPropertyOptional({ example: '18:00', description: 'HH:mm con cero a la izquierda' })
  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime debe ser HH:mm (24h) con cero a la izquierda, ej. 18:00',
  })
  @MaxLength(5)
  endTime?: string;

  @ApiPropertyOptional({
    example: '14:00',
    description: 'Inicio del descanso (HH:mm). Enviar null para quitar el descanso.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v != null)
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'breakStart debe ser HH:mm (24h) con cero a la izquierda, ej. 14:00',
  })
  @MaxLength(5)
  breakStart?: string | null;

  @ApiPropertyOptional({
    example: '15:00',
    description: 'Fin del descanso (HH:mm). Enviar null para quitar el descanso.',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v != null)
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'breakEnd debe ser HH:mm (24h) con cero a la izquierda, ej. 15:00',
  })
  @MaxLength(5)
  breakEnd?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
