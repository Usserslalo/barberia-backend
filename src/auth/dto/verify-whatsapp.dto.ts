import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class VerifyWhatsAppDto {
  @ApiProperty({
    example: 'usuario@example.com',
    description: 'Email del usuario que recibió el código',
  })
  @IsEmail({}, { message: 'El email debe ser un correo válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;

  @ApiProperty({
    example: '123456',
    description: 'Código OTP de 6 dígitos recibido por WhatsApp',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @IsNotEmpty({ message: 'El código es obligatorio' })
  @Length(6, 6, { message: 'El código debe tener exactamente 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'El código debe ser numérico de 6 dígitos' })
  code: string;
}
