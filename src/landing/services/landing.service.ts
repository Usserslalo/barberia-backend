import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../../upload/upload.service';
import { ROLES } from '../../auth/constants/roles';
import {
  LANDING_CONFIG_ID,
  PLACEHOLDER_BARBER_IMAGE,
} from '../constants/landing.constants';
import { CreateBarberDto } from '../dto/create-barber.dto';
import { UpdateBarberDto } from '../dto/update-barber.dto';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';
import { CreateGalleryItemDto } from '../dto/create-gallery-item.dto';
import { UpdateLandingConfigDto } from '../dto/update-landing-config.dto';
import { omitUndefined } from '../utils/omit-undefined';
import { applyImageTransform, type ImageTransformParams } from '../utils/image-transform';
import { buildNavigationUrl, parseGoogleMapsCoords } from '../utils/google-maps-coords';
import type { Barber, GalleryItem, LandingConfig, Service } from '@prisma/client';

const SALT_ROUNDS = 10;
const LANDING_CACHE_KEY = 'landing:page';
const LANDING_BARBERS_CACHE_KEY = 'landing:barbers';
const LANDING_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

/** Barbero con opcional userId cuando tiene cuenta de acceso asociada. */
export type BarberWithUserId = Barber & { userId?: string };

/** Servicio con category (string) rellenado desde categoría relacionada para compatibilidad GET /api/landing */
export interface ServiceWithResolvedCategory {
  id: string;
  name: string;
  description: string | null;
  price: number;
  durationMinutes: number;
  category: string;
  categoryId: string | null;
  isActive: boolean;
}

/** Config extendido con status en tiempo real (open/closed según horarios). */
export type LandingConfigWithStatus = LandingConfig & { status: 'open' | 'closed' };

export interface LandingPageData {
  config: LandingConfigWithStatus & { navigationUrl?: string };
  barbers: Barber[];
  services: ServiceWithResolvedCategory[];
  gallery: GalleryItem[];
}

export interface GetLandingPageOptions {
  galleryLimit?: number;
  galleryOffset?: number;
  /** Parámetros de transformación para URLs de imágenes (Cloudinary/S3). */
  imageTransform?: ImageTransformParams;
}

@Injectable()
export class LandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Obtiene todos los datos necesarios para renderizar la landing (público).
   * Solo barberos con isActive: true. Galería ordenada por createdAt desc.
   * config incluye status: "open" | "closed" según horarios y excepciones.
   * Opcionalmente aplica transformaciones a URLs de imágenes (Cloudinary).
   * Fallos de caché no rompen la petición; barbers.photoUrl nunca es null (placeholder si falta).
   */
  async getLandingPage(options?: GetLandingPageOptions): Promise<LandingPageData> {
    // Solo cachear la respuesta completa (sin query params) para evitar claves distintas.
    if (!options) {
      try {
        const cached = await this.cacheManager.get<LandingPageData>(LANDING_CACHE_KEY);
        if (cached) return cached;
      } catch {
        // Si el caché falla (serialización, store), continuar sin caché
      }
    }

    const config = await this.getConfigOrThrow();
    const status = await this.getBusinessStatus();
    const configWithStatus: LandingConfigWithStatus = { ...config, status };

    const [barbers, servicesRaw, galleryRaw] = await Promise.all([
      this.prisma.barber.findMany({
        where: { isActive: true },
        orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          roleDescription: true,
          bio: true,
          photoUrl: true,
          experienceYears: true,
          displayOrder: true,
          isActive: true,
        },
      }),
      this.prisma.service.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          durationMinutes: true,
          category: true,
          categoryId: true,
          isActive: true,
          categoryRelation: { select: { name: true } },
        },
      }),
      this.prisma.galleryItem.findMany({
        orderBy: { createdAt: 'desc' },
        select: { id: true, imageUrl: true, description: true, createdAt: true },
      }),
    ]);

    const services: ServiceWithResolvedCategory[] = servicesRaw.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      price: s.price,
      durationMinutes: s.durationMinutes,
      category: s.categoryRelation?.name ?? s.category,
      categoryId: s.categoryId,
      isActive: s.isActive,
    }));

    const offset = Math.max(0, options?.galleryOffset ?? 0);
    const limit =
      options?.galleryLimit != null ? Math.min(100, Math.max(1, options.galleryLimit)) : undefined;
    const gallery =
      limit != null
        ? galleryRaw.slice(offset, offset + limit)
        : offset > 0
          ? galleryRaw.slice(offset)
          : galleryRaw;

    const imgParams = options?.imageTransform;

    const navigationUrl = buildNavigationUrl(configWithStatus.latitude, configWithStatus.longitude);
    const result: LandingPageData = {
      config: {
        ...configWithStatus,
        heroBackgroundImage: (applyImageTransform(configWithStatus.heroBackgroundImage, imgParams) ?? configWithStatus.heroBackgroundImage) as string,
        logoUrl: (applyImageTransform(configWithStatus.logoUrl, imgParams) ?? configWithStatus.logoUrl) as string,
        aboutImageUrl: (applyImageTransform(configWithStatus.aboutImageUrl, imgParams) ?? configWithStatus.aboutImageUrl) as string,
        navigationUrl: navigationUrl ?? undefined,
      },
      barbers: barbers.map((b) => {
        const rawUrl = (b.photoUrl?.trim() || PLACEHOLDER_BARBER_IMAGE) as string;
        const photoUrl = applyImageTransform(rawUrl, imgParams) ?? rawUrl;
        return { ...b, photoUrl };
      }),
      services,
      gallery: gallery.map((g) => ({
        ...g,
        imageUrl: (applyImageTransform(g.imageUrl, imgParams) ?? g.imageUrl) as string,
      })),
    };

    if (!options) {
      try {
        await this.cacheManager.set(LANDING_CACHE_KEY, result, LANDING_CACHE_TTL_MS as number);
      } catch {
        // No fallar la respuesta si el caché falla
      }
    }
    return result;
  }

  /**
   * Lista de barberos activos para uso público (wizard de reserva, landing "Nuestro equipo").
   * Solo isActive: true. Si photoUrl es null o vacío se devuelve PLACEHOLDER_BARBER_IMAGE.
   * Opcionalmente aplica transformaciones a photoUrl (Cloudinary).
   * Se cachea solo cuando no hay imageTransform (misma respuesta para todos).
   */
  async getBarbersForPublic(imageTransform?: ImageTransformParams): Promise<(Barber & { photoUrl: string })[]> {
    if (!imageTransform) {
      try {
        const cached = await this.cacheManager.get<(Barber & { photoUrl: string })[]>(LANDING_BARBERS_CACHE_KEY);
        if (cached) return cached;
      } catch {
        // Continuar sin caché
      }
    }

    const barbers = await this.prisma.barber.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        roleDescription: true,
        bio: true,
        photoUrl: true,
        experienceYears: true,
        displayOrder: true,
        isActive: true,
      },
    });
    const result = barbers.map((b) => {
      const rawUrl = (b.photoUrl?.trim() || PLACEHOLDER_BARBER_IMAGE) as string;
      const photoUrl = applyImageTransform(rawUrl, imageTransform) ?? rawUrl;
      return { ...b, photoUrl };
    });

    if (!imageTransform) {
      try {
        await this.cacheManager.set(LANDING_BARBERS_CACHE_KEY, result, LANDING_CACHE_TTL_MS as number);
      } catch {
        // No fallar la respuesta
      }
    }
    return result;
  }

  /**
   * Obtiene la configuración del landing (admin). Lanza si no existe.
   */
  async getConfig(): Promise<LandingConfig> {
    return this.getConfigOrThrow();
  }

  /**
   * Actualiza la configuración del landing (admin). Solo campos enviados.
   * Si se envía googleMapsIframe (URL o iframe HTML), se intenta extraer latitude y longitude automáticamente.
   * Elimina del disco los archivos propios (/uploads/) que se reemplazan.
   */
  async updateConfig(dto: UpdateLandingConfigDto): Promise<LandingConfig> {
    const current = await this.getConfigOrThrow();
    const data = omitUndefined(dto as Record<string, unknown>) as Record<string, unknown>;
    if (Object.keys(data).length === 0) {
      return current;
    }
    // Extraer lat/lng desde URL o iframe de Google Maps si se envió googleMapsIframe
    if (data.googleMapsIframe != null && typeof data.googleMapsIframe === 'string') {
      const coords = parseGoogleMapsCoords(data.googleMapsIframe);
      if (coords) {
        data.latitude = coords.latitude;
        data.longitude = coords.longitude;
      }
    }
    const imageFields = ['heroBackgroundImage', 'logoUrl', 'aboutImageUrl'] as const;
    for (const field of imageFields) {
      if (field in data && current[field] && this.uploadService.isOwnUploadUrl(current[field])) {
        await this.uploadService.deleteFileFromUrl(current[field]);
      }
    }
    const updated = await this.prisma.landingConfig.update({
      where: { id: LANDING_CONFIG_ID },
      data,
    });
    await this.invalidateLandingCache();
    return updated;
  }

  // --- BARBEROS ---

  async getBarbers(includeInactive = false): Promise<BarberWithUserId[]> {
    const barbers = await this.prisma.barber.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
      include: { user: { select: { id: true } } },
    });
    return barbers.map(({ user, ...rest }) => ({
      ...rest,
      userId: user?.id,
    }));
  }

  async getBarberById(id: string): Promise<BarberWithUserId> {
    const barber = await this.prisma.barber.findUnique({
      where: { id },
      include: { user: { select: { id: true } } },
    });
    if (!barber) {
      throw new NotFoundException(`Barbero con id ${id} no encontrado`);
    }
    const { user, ...rest } = barber;
    return { ...rest, userId: user?.id };
  }

  async createBarber(dto: CreateBarberDto): Promise<BarberWithUserId> {
    const hasCredentials =
      dto.email != null &&
      dto.email.trim() !== '' &&
      dto.password != null &&
      dto.password !== '';

    if (hasCredentials) {
      const email = dto.email!.trim();
      const sanitizedEmail = email.toLowerCase();
      const existing = await this.prisma.user.findUnique({
        where: { email: sanitizedEmail },
      });
      if (existing) {
        throw new ConflictException(
          'Ya existe un usuario registrado con este correo electrónico',
        );
      }

      let hashedPassword: string;
      try {
        hashedPassword = await bcrypt.hash(dto.password!, SALT_ROUNDS);
      } catch (error) {
        throw new InternalServerErrorException(
          'Error al procesar la contraseña. Intente de nuevo.',
        );
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const barber = await tx.barber.create({
          data: {
            name: dto.name,
            roleDescription: dto.roleDescription,
            bio: dto.bio ?? null,
            photoUrl: dto.photoUrl ?? null,
            experienceYears: dto.experienceYears ?? 0,
            displayOrder: dto.displayOrder ?? 0,
          },
        });
        await tx.user.create({
          data: {
            email: sanitizedEmail,
            password: hashedPassword,
            firstName: dto.name.split(' ')[0] ?? dto.name,
            lastName: dto.name.split(' ').slice(1).join(' ') || null,
            phone: dto.phone!,
            role: ROLES.BARBER,
            barberId: barber.id,
            isVerified: true,
          },
        });
        return barber;
      });

      const barberWithUser = await this.prisma.barber.findUnique({
        where: { id: result.id },
        include: { user: { select: { id: true } } },
      });
      await this.invalidateLandingCache();
      const { user, ...rest } = barberWithUser!;
      return { ...rest, userId: user?.id };
    }

    const barber = await this.prisma.barber.create({
      data: {
        name: dto.name,
        roleDescription: dto.roleDescription,
        bio: dto.bio ?? null,
        photoUrl: dto.photoUrl ?? null,
        experienceYears: dto.experienceYears ?? 0,
        displayOrder: dto.displayOrder ?? 0,
      },
    });
    await this.invalidateLandingCache();
    const barberWithUser = await this.prisma.barber.findUnique({
      where: { id: barber.id },
      include: { user: { select: { id: true } } },
    });
    const { user, ...rest } = barberWithUser!;
    return { ...rest, userId: user?.id };
  }

  async updateBarber(id: string, dto: UpdateBarberDto): Promise<BarberWithUserId> {
    const current = await this.getBarberById(id);
    const data = omitUndefined(dto as Record<string, unknown>);
    if (Object.keys(data).length === 0) {
      return current;
    }
    if ('photoUrl' in data && current.photoUrl && this.uploadService.isOwnUploadUrl(current.photoUrl)) {
      await this.uploadService.deleteFileFromUrl(current.photoUrl);
    }
    await this.prisma.barber.update({
      where: { id },
      data,
    });
    await this.invalidateLandingCache();
    return this.getBarberById(id);
  }

  /**
   * Soft delete: marca isActive = false.
   */
  async deactivateBarber(id: string): Promise<BarberWithUserId> {
    return this.updateBarber(id, { isActive: false });
  }

  // --- SERVICIOS ---

  async getServices(includeInactive = false): Promise<Service[]> {
    return this.prisma.service.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  }

  async getServiceById(id: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({
      where: { id },
    });
    if (!service) {
      throw new NotFoundException(`Servicio con id ${id} no encontrado`);
    }
    return service;
  }

  /**
   * Categoría siempre derivada de categoryId: nombre de ServiceCategory o "General".
   * El campo legacy category se mantiene en BD para compatibilidad; no se usa dto.category.
   */
  async createService(dto: CreateServiceDto): Promise<Service> {
    let categoryName = 'General';
    if (dto.categoryId) {
      const cat = await this.prisma.serviceCategory.findUnique({
        where: { id: dto.categoryId },
      });
      if (cat) categoryName = cat.name;
    }
    const service = await this.prisma.service.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        durationMinutes: dto.durationMinutes,
        category: categoryName,
        categoryId: dto.categoryId ?? null,
        isActive: dto.isActive ?? true,
      },
    });
    await this.invalidateLandingCache();
    return service;
  }

  /**
   * Categoría siempre derivada de categoryId. Si categoryId está presente en el DTO,
   * se resuelve el nombre; si categoryId es null/undefined, category = "General".
   */
  async updateService(id: string, dto: UpdateServiceDto): Promise<Service> {
    const current = await this.getServiceById(id);
    const data = omitUndefined(dto as Record<string, unknown>) as Record<string, unknown>;
    if (dto.categoryId !== undefined) {
      data.categoryId = dto.categoryId ?? null;
      if (dto.categoryId) {
        const cat = await this.prisma.serviceCategory.findUnique({
          where: { id: dto.categoryId },
        });
        data.category = cat ? cat.name : 'General';
      } else {
        data.category = 'General';
      }
    }
    if (Object.keys(data).length === 0) {
      return current;
    }
    const updated = await this.prisma.service.update({
      where: { id },
      data,
    });
    await this.invalidateLandingCache();
    return updated;
  }

  /**
   * Soft delete: marca isActive = false.
   */
  async deactivateService(id: string): Promise<Service> {
    return this.updateService(id, { isActive: false });
  }

  // --- GALERÍA ---

  async getGallery(): Promise<GalleryItem[]> {
    return this.prisma.galleryItem.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async getGalleryItemById(id: string): Promise<GalleryItem> {
    const item = await this.prisma.galleryItem.findUnique({
      where: { id },
    });
    if (!item) {
      throw new NotFoundException(`Elemento de galería con id ${id} no encontrado`);
    }
    return item;
  }

  async createGalleryItem(dto: CreateGalleryItemDto): Promise<GalleryItem> {
    const item = await this.prisma.galleryItem.create({
      data: {
        imageUrl: dto.imageUrl,
        description: dto.description ?? null,
      },
    });
    await this.invalidateLandingCache();
    return item;
  }

  /**
   * Elimina el ítem de galería y, si imageUrl apunta a /uploads/, borra el archivo del disco.
   */
  async deleteGalleryItem(id: string): Promise<void> {
    const item = await this.getGalleryItemById(id);
    if (this.uploadService.isOwnUploadUrl(item.imageUrl)) {
      await this.uploadService.deleteFileFromUrl(item.imageUrl);
    }
    await this.prisma.galleryItem.delete({
      where: { id },
    });
    await this.invalidateLandingCache();
  }

  /**
   * Obtiene el estado actual de una entidad para el audit log (oldData en PATCH/DELETE).
   * Usado por AuditInterceptor antes de ejecutar el handler.
   */
  async getOldDataForAudit(
    action: string,
    entityId: string | undefined,
  ): Promise<Record<string, unknown> | null> {
    try {
      switch (action) {
        case 'UPDATE_CONFIG': {
          const config = await this.getConfigOrThrow();
          return config as unknown as Record<string, unknown>;
        }
        case 'UPDATE_BARBER':
        case 'DELETE_BARBER':
          if (entityId) {
            const barber = await this.getBarberById(entityId);
            return barber as unknown as Record<string, unknown>;
          }
          return null;
        case 'UPDATE_SERVICE':
        case 'DELETE_SERVICE':
          if (entityId) {
            const service = await this.getServiceById(entityId);
            return service as unknown as Record<string, unknown>;
          }
          return null;
        case 'DELETE_GALLERY_ITEM':
          if (entityId) {
            const item = await this.getGalleryItemById(entityId);
            return item as unknown as Record<string, unknown>;
          }
          return null;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  // --- HELPERS ---

  /** Invalida caché de landing completa y de barbers (ambos endpoints). */
  private async invalidateLandingCache(): Promise<void> {
    try {
      await Promise.all([
        this.cacheManager.del(LANDING_CACHE_KEY),
        this.cacheManager.del(LANDING_BARBERS_CACHE_KEY),
      ]);
    } catch {
      // Ignorar fallos de cache (p. ej. store no disponible)
    }
  }

  private async getConfigOrThrow(): Promise<LandingConfig> {
    const config = await this.prisma.landingConfig.findUnique({
      where: { id: LANDING_CONFIG_ID },
    });
    if (!config) {
      throw new NotFoundException(
        'Configuración del landing no encontrada. Ejecuta el seed: npx prisma db seed',
      );
    }
    return config;
  }

  /**
   * Determina si la barbería está "open" o "closed" según la hora actual (servidor) y los horarios
   * de barberos (BarberWorkSchedule) y excepciones (ScheduleException: CLOSED, HOLIDAY).
   */
  async getBusinessStatus(): Promise<'open' | 'closed'> {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Domingo, 1 = Lunes, ...
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const exception = await this.prisma.scheduleException.findFirst({
      where: {
        date: { gte: startOfToday, lt: startOfTomorrow },
        type: { in: ['CLOSED', 'HOLIDAY'] },
      },
    });
    if (exception) return 'closed';

    const schedules = await this.prisma.barberWorkSchedule.findMany({
      where: { dayOfWeek, isActive: true },
      select: { startTime: true, endTime: true, breakStart: true, breakEnd: true },
    });

    for (const s of schedules) {
      if (timeStr < s.startTime || timeStr > s.endTime) continue;
      if (s.breakStart != null && s.breakEnd != null && timeStr >= s.breakStart && timeStr <= s.breakEnd) continue;
      return 'open';
    }
    return 'closed';
  }
}
