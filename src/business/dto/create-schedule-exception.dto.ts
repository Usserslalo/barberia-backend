import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateScheduleExceptionDto {
  @ApiProperty({
    example: '2026-12-25',
    description: 'Fecha del festivo o cierre (YYYY-MM-DD)',
  })
  @IsDateString()
  date: string;

  @ApiProperty({
    example: 'HOLIDAY',
    description: 'Tipo: HOLIDAY | CLOSED | SPECIAL_HOURS',
    enum: ['HOLIDAY', 'CLOSED', 'SPECIAL_HOURS'],
  })
  @IsString()
  @MaxLength(30)
  type: string;

  @ApiPropertyOptional({ example: 'Navidad' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
