import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateBarberWorkScheduleDto {
  @ApiProperty({
    example: 1,
    description: 'Día de la semana: 0=Dom, 1=Lun, 2=Mar, 3=Mié, 4=Jue, 5=Vie, 6=Sáb',
    minimum: 0,
    maximum: 6,
  })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '09:00', description: 'Hora de inicio (HH:mm con cero a la izquierda)' })
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime debe ser HH:mm (24h) con cero a la izquierda, ej. 09:00',
  })
  @MaxLength(5)
  startTime: string;

  @ApiProperty({ example: '18:00', description: 'Hora de fin (HH:mm con cero a la izquierda)' })
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime debe ser HH:mm (24h) con cero a la izquierda, ej. 18:00',
  })
  @MaxLength(5)
  endTime: string;

  @ApiPropertyOptional({ example: '14:00', description: 'Inicio del descanso (HH:mm con cero a la izquierda)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'breakStart debe ser HH:mm (24h) con cero a la izquierda, ej. 14:00',
  })
  @MaxLength(5)
  breakStart?: string;

  @ApiPropertyOptional({ example: '15:00', description: 'Fin del descanso (HH:mm con cero a la izquierda)' })
  @IsOptional()
  @IsString()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'breakEnd debe ser HH:mm (24h) con cero a la izquierda, ej. 15:00',
  })
  @MaxLength(5)
  breakEnd?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
