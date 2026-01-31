import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'MiClaveActual#123',
    description: 'Contraseña actual (para validar identidad)',
  })
  @IsString()
  @IsNotEmpty({ message: 'La contraseña actual es obligatoria' })
  currentPassword: string;

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
