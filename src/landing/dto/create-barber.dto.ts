import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { IsAllowedImageUrl } from '../validators/allowed-image-url.validator';

export class CreateBarberDto {
  @ApiProperty({
    example: 'Sergey Trifonov',
    description: 'Nombre completo del barbero',
  })
  @IsString()
  @MinLength(1, { message: 'El nombre es obligatorio' })
  @MaxLength(100)
  name: string;

  @ApiProperty({
    example: 'Barber Stylist',
    description: 'Cargo o especialidad del barbero',
  })
  @IsString()
  @MinLength(1, { message: 'El rol es obligatorio' })
  @MaxLength(100)
  roleDescription: string;

  @ApiPropertyOptional({
    example: 'https://example.com/barber.jpg',
    description: 'URL de la foto del barbero',
  })
  @IsOptional()
  @IsUrl({}, { message: 'photoUrl debe ser una URL válida' })
  @IsAllowedImageUrl()
  photoUrl?: string;

  @ApiPropertyOptional({
    example: 5,
    description: 'Años de experiencia',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @ApiPropertyOptional({
    example: 'Especialista en cortes clásicos y barbas. Más de 8 años de experiencia.',
    description: 'Biografía corta para mostrar en el landing',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({
    example: 0,
    description: 'Orden de aparición en el landing (menor = primero). Default: 0.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  /** Si se indica, se crea una cuenta de acceso para el barbero (rol BARBER). Debe enviarse junto con password y phone. */
  @ApiPropertyOptional({
    example: 'barbero@ejemplo.com',
    description: 'Correo para la cuenta de acceso del barbero (obligatorio si se envía password)',
  })
  @IsOptional()
  @ValidateIf((o: CreateBarberDto) => o.password != null && o.password !== '')
  @IsEmail({}, { message: 'El email debe ser un correo válido' })
  email?: string;

  /** Teléfono del barbero en formato E.164. Obligatorio cuando se crea cuenta (email + password). */
  @ApiPropertyOptional({
    example: '+5215512345678',
    description: 'Teléfono en formato E.164 para OTP y notificaciones (obligatorio si se envía email)',
  })
  @IsOptional()
  @ValidateIf((o: CreateBarberDto) => o.email != null && o.email !== '' && o.password != null && o.password !== '')
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'El teléfono debe estar en formato internacional E.164 (ej: +5215512345678)',
  })
  phone?: string;

  /** Si se indica, se crea una cuenta de acceso para el barbero. Debe enviarse junto con email y phone. */
  @ApiPropertyOptional({
    example: 'MiClave#123',
    description:
      'Contraseña para la cuenta del barbero (mín. 6 caracteres, al menos una letra y un número). Obligatorio si se envía email.',
    minLength: 6,
  })
  @IsOptional()
  @ValidateIf((o: CreateBarberDto) => o.email != null && o.email !== '')
  @IsString()
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  password?: string;
}
