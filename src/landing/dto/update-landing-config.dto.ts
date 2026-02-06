import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsAllowedImageUrl } from '../validators/allowed-image-url.validator';

/**
 * DTO para actualizar la configuración del landing (CMS).
 * Todos los campos son opcionales (PATCH parcial).
 */
export class UpdateLandingConfigDto {
  @ApiPropertyOptional({
    example: 'Bober Barbershop',
    description: 'Título principal de la sección Hero',
  })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: 'heroTitle no puede estar vacío' })
  @MaxLength(100)
  heroTitle?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/hero-bg.jpg',
    description: 'URL de la imagen de fondo del Hero',
  })
  @IsOptional()
  @IsUrl({}, { message: 'heroBackgroundImage debe ser una URL válida' })
  @IsAllowedImageUrl()
  heroBackgroundImage?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/logo.png',
    description: 'URL del logotipo',
  })
  @IsOptional()
  @IsUrl({}, { message: 'logoUrl debe ser una URL válida' })
  @IsAllowedImageUrl()
  logoUrl?: string;

  @ApiPropertyOptional({
    example: 'O NAC',
    description: 'Título de la sección Acerca de',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  aboutTitle?: string;

  @ApiPropertyOptional({
    example: 'Somos una barbería clásica...',
    description: 'Texto descriptivo de la sección Acerca de',
  })
  @IsOptional()
  @IsString()
  aboutText?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/about.jpg',
    description: 'URL de la imagen de la sección Acerca de',
  })
  @IsOptional()
  @IsUrl({}, { message: 'aboutImageUrl debe ser una URL válida' })
  @IsAllowedImageUrl()
  aboutImageUrl?: string;

  @ApiPropertyOptional({
    example: '+52 55 1234 5678',
    description: 'Teléfono de contacto',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    example: 'contacto@boberbarbershop.com',
    description: 'Email de contacto',
  })
  @IsOptional()
  @IsEmail({}, { message: 'email debe ser un correo válido' })
  email?: string;

  @ApiPropertyOptional({
    example: 'https://www.instagram.com/boberbarbershop',
    description: 'URL de Instagram',
  })
  @IsOptional()
  @IsUrl({}, { message: 'instagramUrl debe ser una URL válida' })
  instagramUrl?: string;

  @ApiPropertyOptional({
    example: 'https://wa.me/5215512345678',
    description: 'URL de WhatsApp',
  })
  @IsOptional()
  @IsUrl({}, { message: 'whatsappUrl debe ser una URL válida' })
  whatsappUrl?: string;

  @ApiPropertyOptional({
    example: '123456789012345',
    description: 'Phone Number ID de Meta WhatsApp Cloud API',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsappPhoneId?: string;

  @ApiPropertyOptional({
    example: '987654321098765',
    description: 'WhatsApp Business Account ID (WABA ID) de Meta',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  whatsappWabaId?: string;

  @ApiPropertyOptional({
    description: 'Latitud del marcador en el mapa (-90 a 90). Se puede auto-rellenar si se envía googleMapsIframe con URL/iframe de Google Maps.',
    example: 19.4326,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, maxDecimalPlaces: 10 })
  @Min(-90, { message: 'latitude debe estar entre -90 y 90' })
  @Max(90, { message: 'latitude debe estar entre -90 y 90' })
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitud del marcador en el mapa (-180 a 180). Se puede auto-rellenar si se envía googleMapsIframe con URL/iframe de Google Maps.',
    example: -99.1332,
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, maxDecimalPlaces: 10 })
  @Min(-180, { message: 'longitude debe estar entre -180 y 180' })
  @Max(180, { message: 'longitude debe estar entre -180 y 180' })
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Dirección formateada (texto legible para el cliente). Obligatorio cuando se actualiza ubicación (latitude, longitude o googleMapsIframe).',
    example: 'Plaza de la Constitución, Centro Histórico, CDMX',
  })
  @IsOptional()
  @ValidateIf(
    (o: UpdateLandingConfigDto) =>
      o.latitude != null || o.longitude != null || (o.googleMapsIframe != null && o.googleMapsIframe.trim() !== ''),
  )
  @IsString({ message: 'address es obligatorio al actualizar la ubicación' })
  @MinLength(1, { message: 'address es obligatorio al actualizar la ubicación' })
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({
    description:
      'URL de Google Maps o HTML del iframe. Si se envía, se intenta extraer automáticamente latitude y longitude. Si se actualiza ubicación, address es obligatorio.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  googleMapsIframe?: string;
}
