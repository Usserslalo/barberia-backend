import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'usuario@ejemplo.com',
    description: 'Correo electrónico de la cuenta',
  })
  @IsEmail({}, { message: 'El email debe ser un correo válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Código OTP de 6 dígitos recibido por WhatsApp para restablecer contraseña',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @Length(6, 6, { message: 'El código debe tener exactamente 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'El código debe ser numérico de 6 dígitos' })
  code: string;

  @ApiProperty({
    example: 'NuevaClave#456',
    description: 'Nueva contraseña (mínimo 6 caracteres, al menos una letra y un número)',
    minLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'La nueva contraseña es obligatoria' })
  @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'La contraseña debe contener al menos una letra y un número',
  })
  newPassword: string;
}
