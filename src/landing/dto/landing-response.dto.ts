import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO de respuesta para la configuración del landing (Hero, About, Contacto).
 * status indica si la barbería está abierta o cerrada según horarios y excepciones (tiempo real).
 */
export class LandingConfigResponseDto {
  @ApiProperty({ example: '11111111-1111-1111-1111-111111111111' })
  id: string;

  @ApiProperty({
    enum: ['open', 'closed'],
    description: 'Si la barbería está abierta o cerrada según la hora actual y los horarios de barberos.',
  })
  status: 'open' | 'closed';

  @ApiProperty({ example: 'Bober Barbershop' })
  heroTitle: string;

  @ApiProperty({ description: 'URL de la imagen de fondo del Hero' })
  heroBackgroundImage: string;

  @ApiProperty({ description: 'URL del logotipo' })
  logoUrl: string;

  @ApiProperty({ example: 'O NAC' })
  aboutTitle: string;

  @ApiProperty({ description: 'Texto de la sección Acerca de' })
  aboutText: string;

  @ApiProperty({ description: 'URL de la imagen de la sección Acerca de' })
  aboutImageUrl: string;

  @ApiProperty({ example: '+52 55 1234 5678' })
  phone: string;

  @ApiProperty({ example: 'contacto@boberbarbershop.com' })
  email: string;

  @ApiProperty({ required: false, nullable: true })
  instagramUrl: string | null;

  @ApiProperty({ required: false, nullable: true })
  whatsappUrl: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Phone Number ID de Meta WhatsApp Cloud API' })
  whatsappPhoneId: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'WhatsApp Business Account ID (WABA ID) de Meta' })
  whatsappWabaId: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Latitud del marcador' })
  latitude: number | null;

  @ApiProperty({ required: false, nullable: true, description: 'Longitud del marcador' })
  longitude: number | null;

  @ApiProperty({ required: false, nullable: true, description: 'Dirección formateada' })
  address: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'HTML del iframe (legacy)' })
  googleMapsIframe: string | null;

  /** Enlace universal para abrir navegación (Google Maps / Waze) en móvil. Solo presente si hay latitude y longitude. */
  @ApiPropertyOptional({
    example: 'https://www.google.com/maps/search/?api=1&query=19.4326,-99.1332',
    description: 'URL para abrir la ubicación en Google Maps/Waze desde el móvil (calculado si hay lat/lng).',
  })
  navigationUrl?: string | null;

  @ApiProperty()
  updatedAt: Date;
}

export class BarberResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  roleDescription: string;

  @ApiProperty({ required: false, nullable: true, description: 'Biografía corta para el landing' })
  bio: string | null;

  @ApiProperty({ required: false, nullable: true })
  photoUrl: string | null;

  @ApiProperty()
  experienceYears: number;

  @ApiProperty({ description: 'Orden de aparición en el landing (menor = primero)' })
  displayOrder: number;

  @ApiProperty()
  isActive: boolean;

  /** Presente cuando el barbero tiene cuenta de acceso (creada por admin con email/password). */
  @ApiPropertyOptional({ description: 'ID del usuario asociado si tiene cuenta de acceso' })
  userId?: string;
}

export class ServiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false, nullable: true })
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

export class GalleryItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  imageUrl: string;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty()
  createdAt: Date;
}

/**
 * Respuesta agregada para el endpoint público GET /landing.
 * Contiene todo lo necesario para renderizar la landing page.
 */
export class LandingPageResponseDto {
  @ApiProperty({ type: LandingConfigResponseDto })
  config: LandingConfigResponseDto;

  @ApiProperty({ type: [BarberResponseDto] })
  barbers: BarberResponseDto[];

  @ApiProperty({ type: [ServiceResponseDto] })
  services: ServiceResponseDto[];

  @ApiProperty({ type: [GalleryItemResponseDto] })
  gallery: GalleryItemResponseDto[];
}
