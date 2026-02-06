import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';
import { LandingService } from '../services/landing.service';
import { LandingPageResponseDto } from '../dto/landing-response.dto';

/** Rate limit permisivo para APIs públicas de landing (anti-scraping, más permisivo que Auth). */
const LANDING_THROTTLE = { default: { limit: 60, ttl: 60000 } }; // 60 req/min

/** Caché en navegador: 1 minuto para datos de landing. */
const CACHE_CONTROL_LANDING = 'public, max-age=60';

const GALLERY_LIMIT_MAX = 100;
const GALLERY_OFFSET_MIN = 0;

@ApiTags('landing')
@Controller('landing')
@UseGuards(ThrottlerGuard)
@Throttle(LANDING_THROTTLE)
export class LandingController {
  constructor(private readonly landingService: LandingService) {}

  @Get()
  @Public()
  @Header('Cache-Control', CACHE_CONTROL_LANDING)
  @ApiOperation({
    summary: 'Datos completos de la landing (público)',
    description:
      'Devuelve configuración (hero, about, contacto, status open/closed), barberos activos, servicios activos y galería. Cache-Control: 1 min en navegador. Rate limit: 60 req/min.',
  })
  @ApiQuery({ name: 'galleryLimit', required: false, type: Number, description: 'Límite de ítems de galería (paginación).' })
  @ApiQuery({ name: 'galleryOffset', required: false, type: Number, description: 'Offset para galería (paginación).' })
  @ApiQuery({ name: 'width', required: false, type: Number, description: 'Ancho deseado para URLs de imágenes (Cloudinary).' })
  @ApiQuery({ name: 'height', required: false, type: Number, description: 'Alto deseado para URLs de imágenes (Cloudinary).' })
  @ApiQuery({ name: 'format', required: false, enum: ['webp', 'auto'], description: 'Formato de imagen: webp o auto (Cloudinary).' })
  @ApiResponse({ status: 200, description: 'Datos completos del landing (config con status, barbers, services, gallery).', type: LandingPageResponseDto })
  @ApiResponse({ status: 404, description: 'Configuración del landing no encontrada (ejecutar seed).' })
  @ApiResponse({ status: 429, description: 'Too Many Requests. Límite de 60 peticiones por minuto.' })
  async getLandingPage(
    @Query('galleryLimit') galleryLimit?: string,
    @Query('galleryOffset') galleryOffset?: string,
    @Query('width') width?: string,
    @Query('height') height?: string,
    @Query('format') format?: string,
  ): Promise<LandingPageResponseDto> {
    let parsedLimit: number | undefined;
    if (galleryLimit != null && !Number.isNaN(parseInt(galleryLimit, 10))) {
      const n = parseInt(galleryLimit, 10);
      parsedLimit = Math.min(GALLERY_LIMIT_MAX, Math.max(1, n));
    }
    let parsedOffset: number | undefined;
    if (galleryOffset != null && !Number.isNaN(parseInt(galleryOffset, 10))) {
      parsedOffset = Math.max(GALLERY_OFFSET_MIN, parseInt(galleryOffset, 10));
    }
    const parsedWidth = width != null && !Number.isNaN(parseInt(width, 10)) ? parseInt(width, 10) : undefined;
    const parsedHeight = height != null && !Number.isNaN(parseInt(height, 10)) ? parseInt(height, 10) : undefined;
    const imageFormat: 'webp' | 'auto' | undefined = format === 'webp' || format === 'auto' ? format : undefined;
    const imageTransform =
      parsedWidth != null || parsedHeight != null || imageFormat != null
        ? { width: parsedWidth, height: parsedHeight, format: imageFormat }
        : undefined;
    const options =
      parsedLimit != null || parsedOffset != null || imageTransform != null
        ? {
            ...(parsedLimit != null && { galleryLimit: parsedLimit }),
            ...(parsedOffset != null && { galleryOffset: parsedOffset }),
            ...(imageTransform != null && { imageTransform }),
          }
        : undefined;
    return this.landingService.getLandingPage(options) as Promise<LandingPageResponseDto>;
  }

  @Get('barbers')
  @Public()
  @Header('Cache-Control', CACHE_CONTROL_LANDING)
  @ApiOperation({
    summary: 'Barberos activos (mismo dato que la sección Nuestro equipo)',
    description:
      'Lista de barberos con isActive: true. photoUrl siempre poblado (real o placeholder). Cache-Control: 1 min. Rate limit: 60 req/min. Caché en servidor solo cuando no se envían width/height/format.',
  })
  @ApiQuery({ name: 'width', required: false, type: Number, description: 'Ancho para photoUrl (Cloudinary).' })
  @ApiQuery({ name: 'height', required: false, type: Number, description: 'Alto para photoUrl (Cloudinary).' })
  @ApiQuery({ name: 'format', required: false, enum: ['webp', 'auto'], description: 'Formato de imagen (Cloudinary).' })
  @ApiResponse({ status: 200, description: 'Array de barberos (id, name, photoUrl, roleDescription, etc.).' })
  @ApiResponse({ status: 429, description: 'Too Many Requests. Límite de 60 peticiones por minuto.' })
  async getBarbers(
    @Query('width') width?: string,
    @Query('height') height?: string,
    @Query('format') format?: string,
  ): Promise<LandingPageResponseDto['barbers']> {
    const parsedWidth = width != null && !Number.isNaN(parseInt(width, 10)) ? parseInt(width, 10) : undefined;
    const parsedHeight = height != null && !Number.isNaN(parseInt(height, 10)) ? parseInt(height, 10) : undefined;
    const imageFormat: 'webp' | 'auto' | undefined = format === 'webp' || format === 'auto' ? format : undefined;
    const imageTransform =
      parsedWidth != null || parsedHeight != null || imageFormat != null
        ? { width: parsedWidth, height: parsedHeight, format: imageFormat }
        : undefined;
    return this.landingService.getBarbersForPublic(imageTransform);
  }
}
