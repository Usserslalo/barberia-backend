import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { IsAllowedImageUrl } from '../validators/allowed-image-url.validator';

export class CreateGalleryItemDto {
  @ApiProperty({
    example: 'https://example.com/work-1.jpg',
    description: 'URL de la imagen del trabajo realizado',
  })
  @IsUrl({}, { message: 'imageUrl debe ser una URL válida' })
  @IsAllowedImageUrl()
  imageUrl: string;

  @ApiPropertyOptional({
    example: 'Corte + Modelado de barba',
    description: 'Descripción del servicio mostrado en la imagen',
  })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;
}
