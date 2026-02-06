import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../auth/constants/roles';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BusinessService } from '../business.service';
import { CreateScheduleExceptionDto } from '../dto/create-schedule-exception.dto';
import { UpdateScheduleExceptionDto } from '../dto/update-schedule-exception.dto';
import type { ScheduleException } from '@prisma/client';

@ApiTags('business')
@Controller('business/schedule-exceptions')
@UseGuards(RolesGuard)
@Roles(ROLES.ADMIN)
@ApiBearerAuth('access_token')
export class ScheduleExceptionsController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN] Listar excepciones de calendario (festivos, cierres)' })
  @ApiQuery({ name: 'from', required: false, description: 'Fecha desde (YYYY-MM-DD)' })
  @ApiQuery({ name: 'to', required: false, description: 'Fecha hasta (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'Lista de excepciones' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo ADMIN.' })
  async getScheduleExceptions(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<ScheduleException[]> {
    return this.businessService.getScheduleExceptions(from, to);
  }

  @Get(':id')
  @ApiOperation({ summary: '[ADMIN] Obtener excepción por ID' })
  @ApiResponse({ status: 200, description: 'Excepción' })
  @ApiResponse({ status: 404, description: 'Excepción no encontrada.' })
  async getScheduleExceptionById(@Param('id') id: string): Promise<ScheduleException> {
    return this.businessService.getScheduleExceptionById(id);
  }

  @Post()
  @ApiOperation({ summary: '[ADMIN] Crear excepción (festivo, cierre)' })
  @ApiResponse({ status: 201, description: 'Excepción creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  async createScheduleException(
    @Body() dto: CreateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    return this.businessService.createScheduleException(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[ADMIN] Actualizar excepción (PATCH parcial)' })
  @ApiResponse({ status: 200, description: 'Excepción actualizada' })
  @ApiResponse({ status: 404, description: 'Excepción no encontrada.' })
  async updateScheduleException(
    @Param('id') id: string,
    @Body() dto: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    return this.businessService.updateScheduleException(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '[ADMIN] Eliminar excepción' })
  @ApiResponse({ status: 204, description: 'Excepción eliminada' })
  @ApiResponse({ status: 404, description: 'Excepción no encontrada.' })
  async deleteScheduleException(@Param('id') id: string): Promise<void> {
    await this.businessService.deleteScheduleException(id);
  }
}
