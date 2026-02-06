import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

/** Valores permitidos al actualizar estado. PENDING no se puede asignar por este endpoint. */
export const ALLOWED_APPOINTMENT_STATUS_UPDATE = [
  'ACCEPTED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED',
] as const;
export type AllowedAppointmentStatusUpdate =
  (typeof ALLOWED_APPOINTMENT_STATUS_UPDATE)[number];

export class UpdateAppointmentStatusDto {
  @ApiProperty({
    example: 'ACCEPTED',
    description: 'Nuevo estado: ACCEPTED, REJECTED, CANCELLED o COMPLETED',
    enum: ALLOWED_APPOINTMENT_STATUS_UPDATE,
  })
  @IsIn(ALLOWED_APPOINTMENT_STATUS_UPDATE, {
    message: 'status debe ser ACCEPTED, REJECTED, CANCELLED o COMPLETED',
  })
  status: AllowedAppointmentStatusUpdate;

  @ApiPropertyOptional({
    example: 'No hay disponibilidad ese día',
    description: 'Obligatorio cuando status es REJECTED. Motivo del rechazo.',
    maxLength: 500,
  })
  @ValidateIf((o) => o.status === 'REJECTED')
  @IsString()
  @MaxLength(500)
  @IsOptional()
  rejectionReason?: string;
}
