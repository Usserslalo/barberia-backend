import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import type { Appointment, Barber, Service } from '@prisma/client';
import type { AllowedAppointmentStatusUpdate } from './dto/update-appointment-status.dto';
import type { SlotReason } from './dto/available-slots-response.dto';

/** Minutos de buffer tras cada cita antes de poder reservar el siguiente slot. */
const BUFFER_TIME_MINUTES = 10;
/** Antelación mínima para crear una cita (minutos desde ahora). */
const MIN_ADVANCE_BOOKING_MINUTES = 30;
/** Horas mínimas antes de la cita para poder cancelar (si faltan menos, no se permite CANCELLED). */
const MIN_HOURS_BEFORE_APPOINTMENT_TO_CANCEL = 2;
/** Duración del bloqueo temporal del slot (minutos). */
const SLOT_LOCK_MINUTES = 5;
/** Cancelaciones en este número de días para activar penalización. */
const CANCELLATION_PENALTY_DAYS = 30;
/** Número de cancelaciones que activan la penalización. */
const CANCELLATION_PENALTY_COUNT = 3;
/** Días que el usuario no puede crear citas tras activar la penalización. */
const PENALTY_BLOCK_DAYS = 14;

/** Zona horaria por defecto para "hoy" en validaciones (evita rechazar "hoy" cuando el servidor está en UTC). */
const DEFAULT_APPOINTMENTS_TIMEZONE = 'America/Mexico_City';

/**
 * Devuelve la fecha "hoy" como YYYY-MM-DD en la zona horaria indicada.
 * Usar para comparar con date (query) y no rechazar "hoy" del usuario.
 */
function getTodayDateStringInTimezone(timeZone: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone });
}

/**
 * Devuelve la fecha de un Date como YYYY-MM-DD en la zona horaria indicada.
 */
function getDateStringInTimezone(date: Date, timeZone: string): string {
  return date.toLocaleDateString('en-CA', { timeZone });
}

/**
 * Devuelve los minutos desde medianoche (0-1439) de un Date en la zona horaria indicada.
 * Usado para comparar slots (HH:mm) con citas existentes sin depender de la zona del servidor.
 */
function getMinutesSinceMidnightInTimezone(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  return hour * 60 + minute;
}

export type AppointmentWithBarberAndService = Appointment & {
  barber: Barber;
  service: Service;
};

export type AppointmentWithUserAndService = Appointment & {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
  };
  service: Service;
};

export type AvailableSlotsResult = {
  date: string;
  barberId: string;
  serviceId: string;
  durationMinutes: number;
  slots: { time: string; reason: SlotReason }[];
  available: string[];
  occupied: string[];
};

/**
 * Convierte "HH:mm" a minutos desde medianoche.
 */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Convierte minutos desde medianoche a "HH:mm".
 */
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly configService: ConfigService,
  ) {}

  private getAppointmentsTimezone(): string {
    return (
      this.configService.get<string>('APPOINTMENTS_TIMEZONE') ??
      DEFAULT_APPOINTMENTS_TIMEZONE
    );
  }

  /**
   * Cron: cada 60 segundos elimina SlotLocks expirados (expiresAt <= now).
   * Log básico con cantidad eliminada para monitoreo.
   */
  @Interval(60_000)
  async cleanupExpiredSlotLocks(): Promise<void> {
    const now = new Date();
    const result = await this.prisma.slotLock.deleteMany({
      where: { expiresAt: { lte: now } },
    });
    if (result.count > 0) {
      this.logger.log(`SlotLock cleanup: removed ${result.count} expired lock(s)`);
    }
  }

  /**
   * Lista las citas del usuario autenticado, con barber, service, rejectionReason y campos para resumen (totalEstimatedMinutes, servicePrice).
   * Opcional: filtrar por fecha (YYYY-MM-DD). Orden: fecha descendente.
   */
  async getMyAppointments(
    userId: string,
    dateStr?: string,
  ): Promise<(AppointmentWithBarberAndService & { totalEstimatedMinutes: number; servicePrice: number })[]> {
    const where: { userId: string; date?: { gte: Date; lt: Date } } = { userId };
    if (dateStr) {
      const dateOnly = new Date(dateStr);
      if (!Number.isNaN(dateOnly.getTime())) {
        where.date = {
          gte: new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(), 0, 0, 0, 0),
          lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
        };
      }
    }
    const list = await this.prisma.appointment.findMany({
      where,
      include: {
        barber: true,
        service: true,
      },
      orderBy: { date: 'desc' },
    });
    return list.map((apt) => ({
      ...apt,
      totalEstimatedMinutes: apt.service.durationMinutes,
      servicePrice: apt.service.price,
    }));
  }

  /**
   * Lista las citas asignadas al barbero (para rol BARBER). Opcional: filtrar por fecha (ej. "las de hoy").
   * Incluye user (cliente) y service para mostrar en el front.
   */
  async getBarberAppointments(
    barberId: string,
    dateStr?: string,
  ): Promise<AppointmentWithUserAndService[]> {
    const where: { barberId: string; date?: { gte: Date; lt: Date } } = { barberId };
    if (dateStr) {
      const dateOnly = new Date(dateStr);
      if (!Number.isNaN(dateOnly.getTime())) {
        where.date = {
          gte: new Date(dateOnly.getFullYear(), dateOnly.getMonth(), dateOnly.getDate(), 0, 0, 0, 0),
          lt: new Date(dateOnly.getTime() + 24 * 60 * 60 * 1000),
        };
      }
    }
    return this.prisma.appointment.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        service: true,
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Actualiza el estado de una cita.
   * USER: solo puede cancelar sus propias citas (status=CANCELLED), con al menos 2h de antelación.
   * BARBER: solo sus citas; puede ACCEPTED, REJECTED, CANCELLED, COMPLETED.
   * ADMIN: cualquier cita y cualquier transición.
   * Transiciones: PENDING → ACCEPTED | REJECTED | CANCELLED; ACCEPTED → COMPLETED | CANCELLED.
   * REJECTED exige rejectionReason. Loyalty: al pasar ACCEPTED → COMPLETED (primera vez).
   */
  async updateAppointmentStatus(
    id: string,
    dto: { status: AllowedAppointmentStatusUpdate; rejectionReason?: string },
    user: { userId: string; role: string; barberId?: string },
  ): Promise<Appointment> {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id },
    });
    if (!appointment) {
      throw new NotFoundException(`Cita con id ${id} no encontrada`);
    }

    if (user.role === 'USER') {
      if (appointment.userId !== user.userId) {
        throw new ForbiddenException('Solo puede cancelar sus propias citas');
      }
      if (dto.status !== 'CANCELLED') {
        throw new ForbiddenException(
          'Solo puede cancelar sus citas. No puede aceptar, rechazar ni marcar como completada.',
        );
      }
    } else if (user.role === 'BARBER') {
      if (!user.barberId || appointment.barberId !== user.barberId) {
        throw new ForbiddenException('Solo puede cambiar el estado de sus propias citas');
      }
    } else if (user.role !== 'ADMIN') {
      throw new ForbiddenException('No tiene permiso para actualizar el estado de citas');
    }

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
      ACCEPTED: ['COMPLETED', 'CANCELLED'],
      REJECTED: [],
      CANCELLED: [],
      COMPLETED: [],
    };
    const allowed = allowedTransitions[appointment.status];
    if (!allowed?.includes(dto.status)) {
      throw new BadRequestException(
        `No se puede pasar de ${appointment.status} a ${dto.status}`,
      );
    }

    if (dto.status === 'REJECTED') {
      const reason = (dto.rejectionReason ?? '').trim();
      if (!reason) {
        throw new BadRequestException(
          'rejectionReason es obligatorio cuando el estado es REJECTED',
        );
      }
    }

    if (appointment.status === 'COMPLETED' && dto.status === 'CANCELLED') {
      throw new BadRequestException('No se puede cancelar una cita ya completada');
    }

    const now = new Date();
    if (dto.status === 'COMPLETED') {
      const appointmentDay = new Date(appointment.date);
      appointmentDay.setHours(0, 0, 0, 0);
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      if (appointmentDay > today) {
        throw new BadRequestException(
          'Solo se puede marcar como completada una cita cuya fecha sea hoy o anterior',
        );
      }
    }
    if (dto.status === 'CANCELLED') {
      const minCancelTime = new Date(
        now.getTime() + MIN_HOURS_BEFORE_APPOINTMENT_TO_CANCEL * 60 * 60 * 1000,
      );
      if (appointment.date < minCancelTime) {
        throw new BadRequestException(
          `No se puede cancelar una cita con menos de ${MIN_HOURS_BEFORE_APPOINTMENT_TO_CANCEL} horas de antelación`,
        );
      }
    }

    const wasAcceptedNowCompleted =
      appointment.status === 'ACCEPTED' && dto.status === 'COMPLETED';
    const shouldAwardLoyalty =
      wasAcceptedNowCompleted && !appointment.loyaltyPointsAwarded;

    const updateData: {
      status: AllowedAppointmentStatusUpdate;
      rejectionReason?: string | null;
      loyaltyPointsAwarded?: boolean;
    } = {
      status: dto.status,
      ...(shouldAwardLoyalty && { loyaltyPointsAwarded: true }),
    };
    if (dto.status === 'REJECTED' && dto.rejectionReason != null) {
      updateData.rejectionReason = dto.rejectionReason.trim();
    }
    if (dto.status !== 'REJECTED') {
      updateData.rejectionReason = null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const apt = await tx.appointment.update({
        where: { id },
        data: updateData,
      });

      if (shouldAwardLoyalty) {
        await tx.user.update({
          where: { id: appointment.userId },
          data: {
            loyaltyPoints: { increment: 1 },
            totalVisits: { increment: 1 },
          },
        });
      }

      return apt;
    });

    return updated;
  }

  /**
   * Slots del día con razón por slot (AVAILABLE, OUT_OF_WORKING_HOURS, BARBER_BREAK, OCCUPIED_BY_APPOINTMENT, TEMPORARILY_LOCKED).
   * Valida date >= hoy. Opcional userId: slots bloqueados por ese usuario se consideran AVAILABLE (para reservar tras haber bloqueado).
   */
  async getAvailableSlots(
    barberId: string,
    dateStr: string,
    serviceId: string,
    userId?: string,
  ): Promise<AvailableSlotsResult> {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Fecha inválida. Use formato YYYY-MM-DD.');
    }

    const tz = this.getAppointmentsTimezone();
    const todayStr = getTodayDateStringInTimezone(tz);
    if (dateStr < todayStr) {
      throw new BadRequestException('La fecha debe ser igual o posterior a la fecha actual.');
    }

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const [barber, service] = await Promise.all([
      this.prisma.barber.findUnique({ where: { id: barberId } }),
      this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { durationMinutes: true, isActive: true },
      }),
    ]);
    if (!barber || !barber.isActive) {
      throw new NotFoundException('Barbero no encontrado o inactivo');
    }
    if (!service || !service.isActive) {
      throw new NotFoundException('Servicio no encontrado o inactivo');
    }

    const dayOfWeek = dateOnly.getDay();
    const now = new Date();

    // Rango amplio (UTC) para no perder citas que caen en dateStr en la zona del negocio pero en otro día UTC
    const rangeStart = new Date(dateOnly.getTime() - 12 * 60 * 60 * 1000);
    const rangeEnd = new Date(dateOnly.getTime() + 36 * 60 * 60 * 1000);

    const [schedule, exception, appointmentsInRange, activeLocks] = await Promise.all([
      this.prisma.barberWorkSchedule.findUnique({
        where: {
          barberId_dayOfWeek: { barberId, dayOfWeek },
          isActive: true,
        },
      }),
      this.prisma.scheduleException.findFirst({
        where: {
          date: dateOnly,
          type: { in: ['HOLIDAY', 'CLOSED'] },
        },
      }),
      this.prisma.appointment.findMany({
        where: {
          barberId,
          status: { notIn: ['CANCELLED', 'REJECTED'] },
          date: { gte: rangeStart, lt: rangeEnd },
        },
        include: { service: { select: { durationMinutes: true } } },
      }),
      this.prisma.slotLock.findMany({
        where: {
          barberId,
          slotStart: { gte: rangeStart, lt: rangeEnd },
          expiresAt: { gt: now },
        },
        select: { slotStart: true, lockedByUserId: true },
      }),
    ]);

    // Solo citas cuyo día (en zona del negocio) es dateStr; hora en esa zona para bloquear slots
    const existingAppointments = appointmentsInRange.filter(
      (apt) => getDateStringInTimezone(apt.date, tz) === dateStr,
    );

    const durationMinutes = service.durationMinutes;
    const lockedByOtherMinutes = new Set(
      activeLocks
        .filter((l) => getDateStringInTimezone(l.slotStart, tz) === dateStr && l.lockedByUserId !== userId)
        .map((l) => getMinutesSinceMidnightInTimezone(l.slotStart, tz)),
    );
    const lockedByOther = (slotStartMins: number): boolean =>
      lockedByOtherMinutes.has(slotStartMins);

    const blockedRanges: { start: number; end: number }[] = existingAppointments.map(
      (apt) => {
        const startMins = getMinutesSinceMidnightInTimezone(apt.date, tz);
        const duration = apt.service?.durationMinutes ?? 0;
        return { start: startMins, end: startMins + duration + BUFFER_TIME_MINUTES };
      },
    );

    const slots: { time: string; reason: SlotReason }[] = [];
    const available: string[] = [];
    const occupied: string[] = [];

    if (exception || !schedule) {
      return {
        date: dateStr,
        barberId,
        serviceId,
        durationMinutes,
        slots: [],
        available: [],
        occupied: [],
      };
    }

    const workStart = timeToMinutes(schedule.startTime);
    const workEnd = timeToMinutes(schedule.endTime);
    const breakStart = schedule.breakStart != null ? timeToMinutes(schedule.breakStart) : null;
    const breakEnd = schedule.breakEnd != null ? timeToMinutes(schedule.breakEnd) : null;

    const periods: { start: number; end: number }[] = [];
    if (breakStart != null && breakEnd != null) {
      if (workStart < breakStart) periods.push({ start: workStart, end: breakStart });
      if (breakEnd < workEnd) periods.push({ start: breakEnd, end: workEnd });
    } else {
      periods.push({ start: workStart, end: workEnd });
    }

    for (const period of periods) {
      let slotStart = period.start;
      while (slotStart + durationMinutes <= period.end) {
        const slotEnd = slotStart + durationMinutes;
        const timeStr = minutesToTime(slotStart);

        const inBreak =
          breakStart != null &&
          breakEnd != null &&
          slotStart < breakEnd &&
          slotEnd > breakStart;
        const outOfWork = slotStart < workStart || slotEnd > workEnd;
        const overlapsAppointment = blockedRanges.some(
          (b) => slotStart < b.end && slotEnd > b.start,
        );
        const lockedByAnother = lockedByOther(slotStart);

        let reason: SlotReason;
        if (outOfWork) reason = 'OUT_OF_WORKING_HOURS';
        else if (inBreak) reason = 'BARBER_BREAK';
        else if (overlapsAppointment) reason = 'OCCUPIED_BY_APPOINTMENT';
        else if (lockedByAnother) reason = 'TEMPORARILY_LOCKED';
        else reason = 'AVAILABLE';

        slots.push({ time: timeStr, reason });
        if (reason === 'AVAILABLE') {
          available.push(timeStr);
        } else {
          occupied.push(timeStr);
        }
        slotStart += durationMinutes;
      }
    }

    return {
      date: dateStr,
      barberId,
      serviceId,
      durationMinutes,
      slots: slots.sort((a, b) => a.time.localeCompare(b.time)),
      available: available.sort(),
      occupied: occupied.sort(),
    };
  }

  /**
   * Bloquea un slot por 5 minutos. Si el slot está bloqueado por otro usuario, responde TEMPORARILY_LOCKED (409).
   * Si el slot no está disponible (ocupado, fuera de horario, etc.), 400.
   */
  async createSlotLock(
    userId: string,
    dto: { barberId: string; serviceId: string; date: string },
  ): Promise<{ lockId: string; expiresAt: Date }> {
    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Fecha y hora inválidas. Use formato ISO 8601.');
    }

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    const slotsResult = await this.getAvailableSlots(
      dto.barberId,
      dateStr,
      dto.serviceId,
      userId,
    );
    if (!slotsResult.available.includes(timeStr)) {
      const slotInfo = slotsResult.slots.find((s) => s.time === timeStr);
      const reason = slotInfo?.reason ?? 'OCCUPIED_BY_APPOINTMENT';
      if (reason === 'TEMPORARILY_LOCKED') {
        throw new ConflictException({
          code: 'TEMPORARILY_LOCKED',
          message: 'Este horario está temporalmente reservado por otro usuario. Intente en unos minutos.',
        });
      }
      throw new BadRequestException(
        `El horario ${timeStr} no está disponible (${reason}).`,
      );
    }

    const now = new Date();
    const slotStart = new Date(date);
    slotStart.setSeconds(0, 0);
    const expiresAt = new Date(now.getTime() + SLOT_LOCK_MINUTES * 60 * 1000);

    const existing = await this.prisma.slotLock.findUnique({
      where: {
        barberId_slotStart: { barberId: dto.barberId, slotStart },
      },
    });

    if (existing) {
      if (existing.expiresAt <= now) {
        await this.prisma.slotLock.delete({ where: { id: existing.id } });
      } else if (existing.lockedByUserId !== userId) {
        throw new ConflictException({
          code: 'TEMPORARILY_LOCKED',
          message: 'Este horario está temporalmente reservado por otro usuario. Intente en unos minutos.',
        });
      } else {
        await this.prisma.slotLock.update({
          where: { id: existing.id },
          data: { expiresAt },
        });
        return { lockId: existing.id, expiresAt };
      }
    }

    const lock = await this.prisma.slotLock.create({
      data: {
        barberId: dto.barberId,
        slotStart,
        lockedByUserId: userId,
        expiresAt,
      },
    });
    return { lockId: lock.id, expiresAt };
  }

  /**
   * Comprueba si el usuario está en periodo de penalización (3 cancelaciones en 30 días → bloqueo 14 días).
   */
  private async checkCancellationPenalty(userId: string): Promise<void> {
    const now = new Date();
    const from = new Date(now.getTime() - CANCELLATION_PENALTY_DAYS * 24 * 60 * 60 * 1000);
    const cancelled = await this.prisma.appointment.findMany({
      where: {
        userId,
        status: 'CANCELLED',
        updatedAt: { gte: from },
      },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });
    if (cancelled.length < CANCELLATION_PENALTY_COUNT) return;
    const thirdCancellation = cancelled[CANCELLATION_PENALTY_COUNT - 1];
    const blockEnd = new Date(
      thirdCancellation.updatedAt.getTime() + PENALTY_BLOCK_DAYS * 24 * 60 * 60 * 1000,
    );
    if (now < blockEnd) {
      throw new ForbiddenException(
        `No puede crear citas: ha cancelado ${CANCELLATION_PENALTY_COUNT} veces en los últimos ${CANCELLATION_PENALTY_DAYS} días. Bloqueo hasta ${blockEnd.toISOString().slice(0, 10)}.`,
      );
    }
  }

  /**
   * Crea una cita. Valida: penalización por cancelaciones, antelación 30 min, slot disponible o bloqueado por el usuario.
   * Si el slot está bloqueado por otro → 409 TEMPORARILY_LOCKED. Tras crear, libera el lock del usuario y envía WhatsApp.
   */
  async createAppointment(
    userId: string,
    dto: { barberId: string; serviceId: string; date: string; notes?: string },
  ): Promise<Appointment> {
    await this.checkCancellationPenalty(userId);

    const date = new Date(dto.date);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Fecha y hora inválidas. Use formato ISO 8601.');
    }

    const tz = this.getAppointmentsTimezone();
    const todayStr = getTodayDateStringInTimezone(tz);
    const appointmentDateStr = getDateStringInTimezone(date, tz);
    if (appointmentDateStr < todayStr) {
      throw new BadRequestException('La fecha de la cita debe ser hoy o un día futuro.');
    }

    const now = new Date();
    const minBookingTime = new Date(now.getTime() + MIN_ADVANCE_BOOKING_MINUTES * 60 * 1000);
    if (date < minBookingTime) {
      throw new BadRequestException(
        `La cita debe ser al menos ${MIN_ADVANCE_BOOKING_MINUTES} minutos después de la hora actual`,
      );
    }

    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

    const slotsResult = await this.getAvailableSlots(
      dto.barberId,
      dateStr,
      dto.serviceId,
      userId,
    );
    if (!slotsResult.available.includes(timeStr)) {
      const slotInfo = slotsResult.slots.find((s) => s.time === timeStr);
      if (slotInfo?.reason === 'TEMPORARILY_LOCKED') {
        throw new ConflictException({
          code: 'TEMPORARILY_LOCKED',
          message: 'Este horario está temporalmente reservado por otro usuario. Intente en unos minutos.',
        });
      }
      throw new ConflictException(
        'Lo sentimos, este horario acaba de ser reservado',
      );
    }

    const slotStart = new Date(date);
    slotStart.setSeconds(0, 0);
    const existingLock = await this.prisma.slotLock.findUnique({
      where: {
        barberId_slotStart: { barberId: dto.barberId, slotStart },
      },
    });
    if (existingLock && existingLock.expiresAt > now && existingLock.lockedByUserId !== userId) {
      throw new ConflictException({
        code: 'TEMPORARILY_LOCKED',
        message: 'Este horario está temporalmente reservado por otro usuario. Intente en unos minutos.',
      });
    }

    const service = await this.prisma.service.findUnique({
      where: { id: dto.serviceId },
      select: { durationMinutes: true },
    });
    if (!service) {
      throw new NotFoundException('Servicio no encontrado');
    }

    // Validación de límite de horario: EndTime (inicio + duración) no puede exceder la hora de cierre del barbero
    const dayOfWeek = new Date(appointmentDateStr + 'T12:00:00.000Z').getUTCDay();
    const schedule = await this.prisma.barberWorkSchedule.findUnique({
      where: {
        barberId_dayOfWeek: { barberId: dto.barberId, dayOfWeek },
        isActive: true,
      },
    });
    if (schedule) {
      const workEndMins = timeToMinutes(schedule.endTime);
      const appointmentEndMins =
        getMinutesSinceMidnightInTimezone(date, tz) + service.durationMinutes;
      if (appointmentEndMins > workEndMins) {
        throw new BadRequestException(
          'El servicio seleccionado excede el horario laboral del barbero',
        );
      }
    }

    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const rangeStart = new Date(dateOnly.getTime() - 12 * 60 * 60 * 1000);
    const rangeEnd = new Date(dateOnly.getTime() + 36 * 60 * 60 * 1000);
    const newStartMins = getMinutesSinceMidnightInTimezone(date, tz);
    const newEndMins = newStartMins + service.durationMinutes + BUFFER_TIME_MINUTES;

    let appointment: Appointment;
    try {
      appointment = await this.prisma.$transaction(
        async (tx) => {
          // Evitar doble reserva del mismo usuario: no puede tener otra cita PENDING/ACCEPTED en el mismo bloque
          const myAppointmentsOnDay = await tx.appointment.findMany({
            where: {
              userId,
              status: { in: ['PENDING', 'ACCEPTED'] },
              date: { gte: rangeStart, lt: rangeEnd },
            },
            include: { service: { select: { durationMinutes: true } } },
          });
          const myOnSameDay = myAppointmentsOnDay.filter(
            (apt) => getDateStringInTimezone(apt.date, tz) === appointmentDateStr,
          );
          // Solapamiento mismo usuario: límites exclusivos (fin de una = inicio de la otra está permitido).
          // No solapa <=> Nuevo_Fin <= Cita_Inicio OR Nuevo_Inicio >= Cita_Fin  =>  solapa = lo contrario.
          const newEndMinsAppointment = newStartMins + service.durationMinutes;
          const userOverlap = myOnSameDay.some((apt) => {
            const aptStartMins = getMinutesSinceMidnightInTimezone(apt.date, tz);
            const aptEndMins =
              aptStartMins + (apt.service?.durationMinutes ?? 0);
            return (
              newEndMinsAppointment > aptStartMins && newStartMins < aptEndMins
            );
          });
          if (userOverlap) {
            throw new ConflictException(
              'Ya tienes una cita programada que se solapa con este horario',
            );
          }

          const appointmentsInRange = await tx.appointment.findMany({
            where: {
              barberId: dto.barberId,
              status: { notIn: ['CANCELLED', 'REJECTED'] },
              date: { gte: rangeStart, lt: rangeEnd },
            },
            include: { service: { select: { durationMinutes: true } } },
          });
          const existingOnDay = appointmentsInRange.filter(
            (apt) => getDateStringInTimezone(apt.date, tz) === appointmentDateStr,
          );
          // Solo considerar citas de otros clientes para el solapamiento del barbero (buffer entre citas).
          // Las del mismo usuario se validan antes con userOverlap (límites exclusivos, sin buffer).
          const otherClientsOnDay = existingOnDay.filter((apt) => apt.userId !== userId);

          const overlaps = otherClientsOnDay.some((apt) => {
            const aptStartMins = getMinutesSinceMidnightInTimezone(apt.date, tz);
            const aptEndMins =
              aptStartMins + (apt.service?.durationMinutes ?? 0) + BUFFER_TIME_MINUTES;
            return newStartMins < aptEndMins && newEndMins > aptStartMins;
          });

          if (overlaps) {
            throw new ConflictException(
              'Lo sentimos, este horario acaba de ser reservado',
            );
          }

          const apt = await tx.appointment.create({
            data: {
              userId,
              barberId: dto.barberId,
              serviceId: dto.serviceId,
              date,
              notes: dto.notes ?? null,
              status: 'PENDING',
            },
          });

          if (existingLock && existingLock.lockedByUserId === userId) {
            await tx.slotLock.deleteMany({
              where: {
                barberId: dto.barberId,
                slotStart,
              },
            });
          }
          return apt;
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (err) {
      if (err instanceof ConflictException) {
        throw err;
      }
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        throw new ConflictException(
          'Lo sentimos, este horario acaba de ser reservado',
        );
      }
      if (err instanceof Error && /serialization|transaction.*conflict/i.test(err.message)) {
        throw new ConflictException(
          'Lo sentimos, este horario acaba de ser reservado',
        );
      }
      throw err;
    }

    try {
      await this.whatsappService.sendConfirmation(appointment.id);
    } catch (err) {
      this.logger.warn(
        `Confirmación WhatsApp no enviada para cita ${appointment.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return appointment;
  }

  /**
   * Para Cron Job de recordatorios 24h: citas que ocurren entre (now + 23h) y (now + 25h),
   * status PENDING o ACCEPTED y reminderSent = false.
   */
  async getAppointmentIdsForReminder(): Promise<string[]> {
    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    const appointments = await this.prisma.appointment.findMany({
      where: {
        status: { in: ['PENDING', 'ACCEPTED'] },
        reminderSent: false,
        date: { gte: from, lt: to },
      },
      select: { id: true },
    });
    return appointments.map((a) => a.id);
  }
}
