import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Respuesta de una cita para GET my-appointments: detalles completos para listado y resumen/confirmación. */
export class BarberSummaryDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiProperty()
  roleDescription: string;
  @ApiPropertyOptional()
  photoUrl: string | null;
  @ApiProperty()
  experienceYears: number;
  @ApiProperty()
  isActive: boolean;
}

export class ServiceSummaryDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  name: string;
  @ApiPropertyOptional()
  description: string | null;
  @ApiProperty()
  price: number;
  @ApiProperty()
  durationMinutes: number;
  @ApiProperty()
  category: string;
  @ApiProperty()
  isActive: boolean;
}

export class MyAppointmentItemDto {
  @ApiProperty()
  id: string;
  @ApiProperty()
  date: string;
  @ApiProperty({ enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'] })
  status: string;
  @ApiPropertyOptional()
  notes: string | null;
  @ApiPropertyOptional({ description: 'Presente cuando status es REJECTED' })
  rejectionReason: string | null;
  @ApiProperty()
  userId: string;
  @ApiProperty()
  barberId: string;
  @ApiProperty()
  serviceId: string;
  @ApiProperty()
  createdAt: string;
  @ApiProperty()
  updatedAt: string;
  @ApiProperty({ type: BarberSummaryDto })
  barber: BarberSummaryDto;
  @ApiProperty({ type: ServiceSummaryDto })
  service: ServiceSummaryDto;
  /** Tiempo total estimado en minutos (duración del servicio). Para resumen en front. */
  @ApiProperty()
  totalEstimatedMinutes: number;
  /** Precio del servicio. Para resumen en front. */
  @ApiProperty()
  servicePrice: number;
}
