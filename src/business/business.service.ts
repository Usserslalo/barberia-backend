import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceCategoryDto } from './dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from './dto/update-service-category.dto';
import { CreateBarberWorkScheduleDto } from './dto/create-barber-work-schedule.dto';
import { UpdateBarberWorkScheduleDto } from './dto/update-barber-work-schedule.dto';
import { CreateScheduleExceptionDto } from './dto/create-schedule-exception.dto';
import { UpdateScheduleExceptionDto } from './dto/update-schedule-exception.dto';
import { omitUndefined } from '../landing/utils/omit-undefined';
import type { ServiceCategory, BarberWorkSchedule, ScheduleException } from '@prisma/client';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  // --- SERVICE CATEGORIES ---

  async getCategories(includeInactive = false): Promise<ServiceCategory[]> {
    return this.prisma.serviceCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getCategoryById(id: string): Promise<ServiceCategory> {
    const cat = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!cat) {
      throw new NotFoundException(`Categoría con id ${id} no encontrada`);
    }
    return cat;
  }

  async getCategoryBySlug(slug: string): Promise<ServiceCategory | null> {
    return this.prisma.serviceCategory.findUnique({
      where: { slug },
    });
  }

  async createCategory(dto: CreateServiceCategoryDto): Promise<ServiceCategory> {
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { slug: dto.slug },
    });
    if (existing) {
      throw new ConflictException(`Ya existe una categoría con el slug "${dto.slug}"`);
    }
    return this.prisma.serviceCategory.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        color: dto.color ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateCategory(id: string, dto: UpdateServiceCategoryDto): Promise<ServiceCategory> {
    await this.getCategoryById(id);
    if (dto.slug != null) {
      const existing = await this.prisma.serviceCategory.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (existing) {
        throw new ConflictException(`Ya existe otra categoría con el slug "${dto.slug}"`);
      }
    }
    const data = omitUndefined(dto as Record<string, unknown>);
    if (Object.keys(data).length === 0) {
      return this.getCategoryById(id);
    }
    return this.prisma.serviceCategory.update({
      where: { id },
      data,
    });
  }

  async deactivateCategory(id: string): Promise<ServiceCategory> {
    return this.updateCategory(id, { isActive: false });
  }

  // --- BARBER WORK SCHEDULES ---

  async getWorkSchedulesByBarber(barberId: string): Promise<BarberWorkSchedule[]> {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber) {
      throw new NotFoundException(`Barbero con id ${barberId} no encontrado`);
    }
    return this.prisma.barberWorkSchedule.findMany({
      where: { barberId },
      orderBy: { dayOfWeek: 'asc' },
    });
  }

  async getWorkScheduleById(id: string): Promise<BarberWorkSchedule> {
    const schedule = await this.prisma.barberWorkSchedule.findUnique({
      where: { id },
    });
    if (!schedule) {
      throw new NotFoundException(`Horario con id ${id} no encontrado`);
    }
    return schedule;
  }

  /** Convierte "HH:mm" a minutos desde medianoche para comparar */
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  private validateWorkScheduleTimes(
    startTime: string,
    endTime: string,
    breakStart?: string | null,
    breakEnd?: string | null,
  ): void {
    const start = this.timeToMinutes(startTime);
    const end = this.timeToMinutes(endTime);
    if (end <= start) {
      throw new BadRequestException(
        'endTime debe ser posterior a startTime',
      );
    }
    if (breakStart != null && breakEnd != null) {
      const bStart = this.timeToMinutes(breakStart);
      const bEnd = this.timeToMinutes(breakEnd);
      if (bEnd <= bStart) {
        throw new BadRequestException(
          'breakEnd debe ser posterior a breakStart',
        );
      }
      const workDurationMinutes = end - start;
      const breakDurationMinutes = bEnd - bStart;
      if (breakDurationMinutes >= workDurationMinutes) {
        throw new BadRequestException(
          'El bloque de descanso no puede ser igual o mayor que la jornada laboral completa',
        );
      }
      if (bStart < start || bEnd > end) {
        throw new BadRequestException(
          'El descanso debe estar dentro del horario laboral: entre startTime y endTime',
        );
      }
    } else if (breakStart != null || breakEnd != null) {
      throw new BadRequestException(
        'breakStart y breakEnd deben enviarse juntos',
      );
    }
  }

  async createWorkSchedule(
    barberId: string,
    dto: CreateBarberWorkScheduleDto,
  ): Promise<BarberWorkSchedule> {
    this.validateWorkScheduleTimes(
      dto.startTime,
      dto.endTime,
      dto.breakStart,
      dto.breakEnd,
    );
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber) {
      throw new NotFoundException(`Barbero con id ${barberId} no encontrado`);
    }
    const existing = await this.prisma.barberWorkSchedule.findUnique({
      where: {
        barberId_dayOfWeek: { barberId, dayOfWeek: dto.dayOfWeek },
      },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe un horario para este barbero en el día ${dto.dayOfWeek}. Use PATCH para actualizar.`,
      );
    }
    return this.prisma.barberWorkSchedule.create({
      data: {
        barberId,
        dayOfWeek: dto.dayOfWeek,
        startTime: dto.startTime,
        endTime: dto.endTime,
        breakStart: dto.breakStart ?? null,
        breakEnd: dto.breakEnd ?? null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateWorkSchedule(
    id: string,
    dto: UpdateBarberWorkScheduleDto,
  ): Promise<BarberWorkSchedule> {
    const existing = await this.getWorkScheduleById(id);
    const startTime = dto.startTime ?? existing.startTime;
    const endTime = dto.endTime ?? existing.endTime;
    const breakStart =
      dto.breakStart !== undefined ? dto.breakStart : existing.breakStart;
    const breakEnd =
      dto.breakEnd !== undefined ? dto.breakEnd : existing.breakEnd;
    this.validateWorkScheduleTimes(
      startTime,
      endTime,
      breakStart ?? undefined,
      breakEnd ?? undefined,
    );

    const data = omitUndefined(dto as Record<string, unknown>) as Record<
      string,
      unknown
    >;
    if (dto.breakStart === null) {
      data.breakStart = null;
    }
    if (dto.breakEnd === null) {
      data.breakEnd = null;
    }
    if (Object.keys(data).length === 0) {
      return this.getWorkScheduleById(id);
    }
    if (dto.dayOfWeek != null) {
      const schedule = await this.getWorkScheduleById(id);
      const conflicting = await this.prisma.barberWorkSchedule.findFirst({
        where: {
          barberId: schedule.barberId,
          dayOfWeek: dto.dayOfWeek,
          id: { not: id },
        },
      });
      if (conflicting) {
        throw new ConflictException(
          `Ya existe un horario para este barbero en el día ${dto.dayOfWeek}.`,
        );
      }
    }
    return this.prisma.barberWorkSchedule.update({
      where: { id },
      data,
    });
  }

  async deleteWorkSchedule(id: string): Promise<void> {
    await this.getWorkScheduleById(id);
    await this.prisma.barberWorkSchedule.delete({
      where: { id },
    });
  }

  // --- SCHEDULE EXCEPTIONS ---

  async getScheduleExceptions(from?: string, to?: string): Promise<ScheduleException[]> {
    const where: { date?: { gte?: Date; lte?: Date } } = {};
    if (from) where.date = { ...where.date, gte: new Date(from) };
    if (to) where.date = { ...where.date, lte: new Date(to) };
    return this.prisma.scheduleException.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { date: 'asc' },
    });
  }

  async getScheduleExceptionById(id: string): Promise<ScheduleException> {
    const ex = await this.prisma.scheduleException.findUnique({
      where: { id },
    });
    if (!ex) {
      throw new NotFoundException(`Excepción con id ${id} no encontrada`);
    }
    return ex;
  }

  async createScheduleException(dto: CreateScheduleExceptionDto): Promise<ScheduleException> {
    const date = new Date(dto.date);
    date.setHours(0, 0, 0, 0);
    return this.prisma.scheduleException.create({
      data: {
        date,
        type: dto.type,
        description: dto.description ?? null,
      },
    });
  }

  async updateScheduleException(
    id: string,
    dto: UpdateScheduleExceptionDto,
  ): Promise<ScheduleException> {
    await this.getScheduleExceptionById(id);
    const data: { date?: Date; type?: string; description?: string | null } = omitUndefined(
      dto as Record<string, unknown>,
    );
    if (dto.date) {
      const d = new Date(dto.date);
      d.setHours(0, 0, 0, 0);
      data.date = d;
    }
    if (Object.keys(data).length === 0) {
      return this.getScheduleExceptionById(id);
    }
    return this.prisma.scheduleException.update({
      where: { id },
      data,
    });
  }

  async deleteScheduleException(id: string): Promise<void> {
    await this.getScheduleExceptionById(id);
    await this.prisma.scheduleException.delete({
      where: { id },
    });
  }
}
