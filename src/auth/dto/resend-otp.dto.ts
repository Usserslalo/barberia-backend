import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty({
    example: 'usuario@ejemplo.com',
    description: 'Correo electrónico para reenviar el código de verificación OTP',
  })
  @IsEmail({}, { message: 'El email debe ser un correo válido' })
  @IsNotEmpty({ message: 'El email es obligatorio' })
  email: string;
}
