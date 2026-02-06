import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ROLES } from '../auth/constants/roles';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AppointmentsService } from './appointments.service';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { CreateSlotLockDto } from './dto/create-slot-lock.dto';
import { UpdateAppointmentStatusDto } from './dto/update-appointment-status.dto';
import type { JwtValidatedUser } from '../auth/strategies/jwt.strategy';
import type { Appointment } from '@prisma/client';
import type {
  AvailableSlotsResult,
  AppointmentWithBarberAndService,
  AppointmentWithUserAndService,
} from './appointments.service';

@ApiTags('appointments')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Mis citas',
    description:
      'Lista las citas del usuario autenticado. Opcional: filtrar por fecha (query date=YYYY-MM-DD). Incluye barber y service. Orden: fecha descendente.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Filtrar por día (YYYY-MM-DD), ej. las de hoy',
  })
  @ApiResponse({
    status: 200,
    description: 'Mis citas con barber, service, rejectionReason, totalEstimatedMinutes y servicePrice (para resumen/confirmación)',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'] },
          notes: { type: 'string', nullable: true },
          rejectionReason: { type: 'string', nullable: true },
          userId: { type: 'string' },
          barberId: { type: 'string' },
          serviceId: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          totalEstimatedMinutes: { type: 'number' },
          servicePrice: { type: 'number' },
          barber: { type: 'object' },
          service: { type: 'object' },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  async getMyAppointments(
    @CurrentUser() user: JwtValidatedUser,
    @Query('date') date?: string,
  ): Promise<(AppointmentWithBarberAndService & { totalEstimatedMinutes: number; servicePrice: number })[]> {
    return this.appointmentsService.getMyAppointments(user.userId, date);
  }

  @Get('barber')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.BARBER)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: '[BARBER] Mis citas como barbero',
    description:
      'Lista las citas asignadas al barbero autenticado. Opcional: date=YYYY-MM-DD para filtrar por día (ej. las de hoy). Incluye user (cliente) y service.',
  })
  @ApiQuery({
    name: 'date',
    required: false,
    description: 'Filtrar por día (YYYY-MM-DD), ej. las de hoy',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de citas del barbero con user y service',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          date: { type: 'string', format: 'date-time' },
          status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'] },
          notes: { type: 'string', nullable: true },
          userId: { type: 'string' },
          barberId: { type: 'string' },
          serviceId: { type: 'string' },
          user: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              firstName: { type: 'string', nullable: true },
              lastName: { type: 'string', nullable: true },
              email: { type: 'string' },
              phone: { type: 'string', nullable: true },
            },
          },
          service: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              price: { type: 'number' },
              durationMinutes: { type: 'number' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo rol BARBER.' })
  async getBarberAppointments(
    @CurrentUser() user: JwtValidatedUser,
    @Query('date') date?: string,
  ): Promise<AppointmentWithUserAndService[]> {
    if (!user.barberId) {
      throw new ForbiddenException('Usuario barbero sin perfil de barbero asignado');
    }
    return this.appointmentsService.getBarberAppointments(user.barberId, date);
  }

  @Get('available-slots')
  @Public()
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({
    summary: 'Slots con razón por horario (disponible / ocupado / bloqueado)',
    description:
      'Fecha debe ser >= hoy. Devuelve slots con reason: AVAILABLE, OUT_OF_WORKING_HOURS, BARBER_BREAK, OCCUPIED_BY_APPOINTMENT, TEMPORARILY_LOCKED. Incluye available y occupied para compatibilidad.',
  })
  @ApiQuery({ name: 'barberId', required: true, description: 'UUID del barbero' })
  @ApiQuery({ name: 'date', required: true, description: 'Fecha YYYY-MM-DD' })
  @ApiQuery({ name: 'serviceId', required: true, description: 'UUID del servicio (define duración del slot)' })
  @ApiResponse({
    status: 200,
    description: 'Slots con time y reason; available (horas seleccionables) y occupied (horas no disponibles)',
    schema: {
      type: 'object',
      properties: {
        date: { type: 'string', example: '2026-02-15' },
        barberId: { type: 'string' },
        serviceId: { type: 'string' },
        durationMinutes: { type: 'number' },
        slots: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              time: { type: 'string', example: '09:00' },
              reason: {
                type: 'string',
                enum: ['AVAILABLE', 'OUT_OF_WORKING_HOURS', 'BARBER_BREAK', 'OCCUPIED_BY_APPOINTMENT', 'TEMPORARILY_LOCKED'],
              },
            },
          },
        },
        available: { type: 'array', items: { type: 'string' } },
        occupied: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos o fecha anterior a hoy.' })
  @ApiResponse({ status: 404, description: 'Barbero o servicio no encontrado o inactivo.' })
  async getAvailableSlots(
    @Query() query: AvailableSlotsQueryDto,
  ): Promise<AvailableSlotsResult> {
    return this.appointmentsService.getAvailableSlots(
      query.barberId,
      query.date,
      query.serviceId,
    );
  }

  @Post('slot-lock')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Bloquear slot temporalmente (5 min)',
    description:
      'Al seleccionar un horario, el cliente bloquea el slot 5 minutos. Si otro usuario intenta el mismo slot, recibe 409 TEMPORARILY_LOCKED. Confirmar con POST /appointments antes de que expire.',
  })
  @ApiBody({ type: CreateSlotLockDto })
  @ApiResponse({
    status: 200,
    description: 'Slot bloqueado',
    schema: {
      type: 'object',
      properties: {
        lockId: { type: 'string', format: 'uuid' },
        expiresAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Horario no disponible (fuera de horario, ocupado, etc.).' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({
    status: 409,
    description: 'Slot bloqueado por otro usuario (TEMPORARILY_LOCKED).',
    schema: { type: 'object', properties: { code: { type: 'string', example: 'TEMPORARILY_LOCKED' }, message: { type: 'string' } } },
  })
  async createSlotLock(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: CreateSlotLockDto,
  ): Promise<{ lockId: string; expiresAt: Date }> {
    return this.appointmentsService.createSlotLock(user.userId, dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Crear cita (reservar)',
    description:
      'Valida antelación mínima 30 min y slot disponible (buffer 10 min entre citas). Tras crear, envía confirmación por WhatsApp. Si el slot se ocupó, 409. Puntos de lealtad al completar (PATCH→COMPLETED).',
  })
  @ApiBody({ type: CreateAppointmentDto })
  @ApiResponse({
    status: 201,
    description: 'Cita creada',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        date: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['PENDING', 'COMPLETED', 'CANCELLED'] },
        notes: { type: 'string', nullable: true },
        userId: { type: 'string' },
        barberId: { type: 'string' },
        serviceId: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Usuario en periodo de penalización por cancelaciones.' })
  @ApiResponse({ status: 404, description: 'Barbero o servicio no encontrado.' })
  @ApiResponse({
    status: 409,
    description: 'Slot ocupado o TEMPORARILY_LOCKED (code en body).',
  })
  async createAppointment(
    @CurrentUser() user: JwtValidatedUser,
    @Body() dto: CreateAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.createAppointment(user.userId, dto);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.ADMIN, ROLES.BARBER, ROLES.USER)
  @ApiBearerAuth('access_token')
  @ApiOperation({
    summary: 'Actualizar estado de una cita',
    description:
      'USER: solo puede cancelar sus propias citas (status=CANCELLED), con al menos 2h de antelación. ADMIN/BARBER: PENDING→ACCEPTED|REJECTED|CANCELLED; ACCEPTED→COMPLETED|CANCELLED. rejectionReason obligatorio cuando status=REJECTED.',
  })
  @ApiBody({ type: UpdateAppointmentStatusDto })
  @ApiResponse({
    status: 200,
    description: 'Cita actualizada',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        date: { type: 'string', format: 'date-time' },
        status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'COMPLETED'] },
        notes: { type: 'string', nullable: true },
        rejectionReason: { type: 'string', nullable: true },
        userId: { type: 'string' },
        barberId: { type: 'string' },
        serviceId: { type: 'string' },
        createdAt: { type: 'string', format: 'date-time' },
        updatedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Transición no permitida, rejectionReason faltante (REJECTED), fecha futura (COMPLETED) o menos de 2h para cancelar (CANCELLED).' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'USER: no es dueño de la cita o intenta un estado distinto de CANCELLED. BARBER: cita de otro barbero.' })
  @ApiResponse({ status: 404, description: 'Cita no encontrada.' })
  async updateAppointmentStatus(
    @CurrentUser() user: JwtValidatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAppointmentStatusDto,
  ): Promise<Appointment> {
    return this.appointmentsService.updateAppointmentStatus(id, dto, user);
  }
}
