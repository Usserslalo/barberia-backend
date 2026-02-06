import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

/** Acepta formato UUID (8-4-4-4-12 hex) incluyendo IDs del seed (ej. 33333333-3333-3333-3333-333333333301). */
const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateAppointmentDto {
  @ApiProperty({
    example: '33333333-3333-3333-3333-333333333301',
    description: 'ID del barbero (UUID)',
  })
  @IsString()
  @IsNotEmpty({ message: 'barberId es obligatorio' })
  @Matches(UUID_LIKE_REGEX, { message: 'barberId debe ser un UUID válido' })
  barberId: string;

  @ApiProperty({
    example: '22222222-2222-2222-2222-222222222201',
    description: 'ID del servicio (UUID)',
  })
  @IsString()
  @IsNotEmpty({ message: 'serviceId es obligatorio' })
  @Matches(UUID_LIKE_REGEX, { message: 'serviceId debe ser un UUID válido' })
  serviceId: string;

  @ApiProperty({
    example: '2026-02-15T09:00:00.000Z',
    description: 'Fecha y hora de la cita en formato ISO 8601',
  })
  @IsDateString(
    {},
    { message: 'date debe ser una fecha y hora válida en formato ISO' },
  )
  @IsNotEmpty({ message: 'date es obligatoria' })
  date: string;

  @ApiPropertyOptional({
    example: 'Corte bajo por los lados',
    description: 'Notas opcionales para el barbero',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
