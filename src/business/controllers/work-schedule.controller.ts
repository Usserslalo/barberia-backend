import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../../auth/constants/roles';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { BusinessService } from '../business.service';
import { CreateBarberWorkScheduleDto } from '../dto/create-barber-work-schedule.dto';
import { UpdateBarberWorkScheduleDto } from '../dto/update-barber-work-schedule.dto';
import type { BarberWorkSchedule } from '@prisma/client';
import type { JwtValidatedUser } from '../../auth/strategies/jwt.strategy';

@ApiTags('business')
@Controller('business/barbers')
@UseGuards(RolesGuard)
@Roles(ROLES.ADMIN, ROLES.BARBER)
@ApiBearerAuth('access_token')
export class WorkScheduleController {
  constructor(private readonly businessService: BusinessService) {}

  @Get(':barberId/work-schedules')
  @ApiOperation({ summary: '[ADMIN/BARBER] Listar horarios de un barbero. BARBER solo puede ver los suyos.' })
  @ApiResponse({ status: 200, description: 'Lista de horarios por día (0-6)' })
  @ApiResponse({ status: 403, description: 'BARBER intentando ver horarios de otro barbero.' })
  @ApiResponse({ status: 404, description: 'Barbero no encontrado.' })
  async getWorkSchedulesByBarber(
    @CurrentUser() user: JwtValidatedUser,
    @Param('barberId') barberId: string,
  ): Promise<BarberWorkSchedule[]> {
    if (user.role === 'BARBER' && user.barberId !== barberId) {
      throw new ForbiddenException('Solo puede consultar sus propios horarios');
    }
    return this.businessService.getWorkSchedulesByBarber(barberId);
  }

  @Post(':barberId/work-schedules')
  @Roles(ROLES.ADMIN)
  @ApiOperation({ summary: '[ADMIN] Crear horario para un barbero (un día)' })
  @ApiResponse({ status: 201, description: 'Horario creado' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 404, description: 'Barbero no encontrado.' })
  @ApiResponse({ status: 409, description: 'Ya existe horario para ese día.' })
  async createWorkSchedule(
    @Param('barberId') barberId: string,
    @Body() dto: CreateBarberWorkScheduleDto,
  ): Promise<BarberWorkSchedule> {
    return this.businessService.createWorkSchedule(barberId, dto);
  }

  @Patch('work-schedules/:id')
  @ApiOperation({ summary: '[ADMIN/BARBER] Actualizar un horario por ID. BARBER solo los suyos.' })
  @ApiResponse({ status: 200, description: 'Horario actualizado' })
  @ApiResponse({ status: 403, description: 'BARBER intentando editar horario de otro barbero.' })
  @ApiResponse({ status: 404, description: 'Horario no encontrado.' })
  async updateWorkSchedule(
    @CurrentUser() user: JwtValidatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBarberWorkScheduleDto,
  ): Promise<BarberWorkSchedule> {
    if (user.role === 'BARBER') {
      const schedule = await this.businessService.getWorkScheduleById(id);
      if (schedule.barberId !== user.barberId) {
        throw new ForbiddenException('Solo puede editar sus propios horarios');
      }
    }
    return this.businessService.updateWorkSchedule(id, dto);
  }

  @Delete('work-schedules/:id')
  @ApiOperation({ summary: '[ADMIN/BARBER] Eliminar un horario. BARBER solo los suyos.' })
  @ApiResponse({ status: 204, description: 'Horario eliminado' })
  @ApiResponse({ status: 403, description: 'BARBER intentando eliminar horario de otro barbero.' })
  @ApiResponse({ status: 404, description: 'Horario no encontrado.' })
  async deleteWorkSchedule(
    @CurrentUser() user: JwtValidatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    if (user.role === 'BARBER') {
      const schedule = await this.businessService.getWorkScheduleById(id);
      if (schedule.barberId !== user.barberId) {
        throw new ForbiddenException('Solo puede eliminar sus propios horarios');
      }
    }
    await this.businessService.deleteWorkSchedule(id);
  }
}
