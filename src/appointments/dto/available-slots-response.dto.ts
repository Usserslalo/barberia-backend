import { ApiProperty } from '@nestjs/swagger';

/** Razón por la que un slot está disponible o no (para pintar UI: verde/rojo/amarillo). */
export const SLOT_REASON = [
  'AVAILABLE',
  'OUT_OF_WORKING_HOURS',
  'BARBER_BREAK',
  'OCCUPIED_BY_APPOINTMENT',
  'TEMPORARILY_LOCKED',
] as const;
export type SlotReason = (typeof SLOT_REASON)[number];

export class SlotWithReasonDto {
  @ApiProperty({ example: '09:00', description: 'Hora de inicio del slot (HH:mm)' })
  time: string;

  @ApiProperty({
    enum: SLOT_REASON,
    description: 'Por qué el slot está disponible o no',
  })
  reason: SlotReason;
}

export class AvailableSlotsResponseDto {
  @ApiProperty({ example: '2026-02-15', description: 'Fecha del día consultado (YYYY-MM-DD)' })
  date: string;

  @ApiProperty({ description: 'ID del barbero' })
  barberId: string;

  @ApiProperty({ description: 'ID del servicio' })
  serviceId: string;

  @ApiProperty({ description: 'Duración del servicio en minutos' })
  durationMinutes: number;

  @ApiProperty({
    type: [SlotWithReasonDto],
    description: 'Lista de slots con su razón (AVAILABLE, OUT_OF_WORKING_HOURS, etc.)',
  })
  slots: SlotWithReasonDto[];

  /** Compatibilidad: solo horarios disponibles (reason === AVAILABLE). */
  @ApiProperty({ type: [String], example: ['09:00', '10:00'] })
  available: string[];

  /** Compatibilidad: horarios ocupados o bloqueados (reason !== AVAILABLE). */
  @ApiProperty({ type: [String], example: ['11:00'] })
  occupied: string[];
}
