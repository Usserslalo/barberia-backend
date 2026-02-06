import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ROLES } from '../../auth/constants/roles';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { LandingService } from '../services/landing.service';
import { AuditService } from '../services/audit.service';
import { AuditInterceptor } from '../interceptors/audit.interceptor';
import { UpdateLandingConfigDto } from '../dto/update-landing-config.dto';
import { CreateBarberDto } from '../dto/create-barber.dto';
import { UpdateBarberDto } from '../dto/update-barber.dto';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';
import { CreateGalleryItemDto } from '../dto/create-gallery-item.dto';
import { AuditLogQueryDto } from '../dto/audit-log-query.dto';
import {
  LandingConfigResponseDto,
  BarberResponseDto,
  ServiceResponseDto,
  GalleryItemResponseDto,
} from '../dto/landing-response.dto';

@ApiTags('landing-admin')
@Controller('landing/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.ADMIN)
@UseInterceptors(AuditInterceptor)
@ApiBearerAuth('access_token')
export class LandingAdminController {
  constructor(
    private readonly landingService: LandingService,
    private readonly auditService: AuditService,
  ) {}

  // --- CONFIG ---

  @Get('config')
  @ApiOperation({
    summary: '[ADMIN] Obtener configuración del landing',
  })
  @ApiResponse({ status: 200, type: LandingConfigResponseDto })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo ADMIN.' })
  async getConfig() {
    return this.landingService.getConfig();
  }

  @Patch('config')
  @ApiOperation({
    summary: '[ADMIN] Actualizar configuración del landing (PATCH parcial)',
  })
  @ApiResponse({ status: 200, type: LandingConfigResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo ADMIN.' })
  async updateConfig(@Body() dto: UpdateLandingConfigDto) {
    return this.landingService.updateConfig(dto);
  }

  // --- BARBEROS ---

  @Get('barbers')
  @ApiOperation({ summary: '[ADMIN] Listar barberos (incluye inactivos)' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Incluir barberos inactivos',
  })
  @ApiResponse({ status: 200, type: [BarberResponseDto] })
  async getBarbers(
    @Query('includeInactive') includeInactive?: string,
  ) {
    const include = includeInactive === 'true';
    return this.landingService.getBarbers(include);
  }

  @Get('barbers/:id')
  @ApiOperation({ summary: '[ADMIN] Obtener barbero por ID' })
  @ApiResponse({ status: 200, type: BarberResponseDto })
  @ApiResponse({ status: 404, description: 'Barbero no encontrado.' })
  async getBarberById(@Param('id') id: string) {
    return this.landingService.getBarberById(id);
  }

  @Post('barbers')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[ADMIN] Crear barbero' })
  @ApiResponse({ status: 201, type: BarberResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  async createBarber(@Body() dto: CreateBarberDto) {
    return this.landingService.createBarber(dto);
  }

  @Patch('barbers/:id')
  @ApiOperation({ summary: '[ADMIN] Actualizar barbero (PATCH parcial)' })
  @ApiResponse({ status: 200, type: BarberResponseDto })
  @ApiResponse({ status: 404, description: 'Barbero no encontrado.' })
  async updateBarber(@Param('id') id: string, @Body() dto: UpdateBarberDto) {
    return this.landingService.updateBarber(id, dto);
  }

  @Delete('barbers/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Desactivar barbero (soft delete)',
  })
  @ApiResponse({ status: 200, type: BarberResponseDto })
  @ApiResponse({ status: 404, description: 'Barbero no encontrado.' })
  async deactivateBarber(@Param('id') id: string) {
    return this.landingService.deactivateBarber(id);
  }

  // --- SERVICIOS ---

  @Get('services')
  @ApiOperation({ summary: '[ADMIN] Listar servicios (incluye inactivos)' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Incluir servicios inactivos',
  })
  @ApiResponse({ status: 200, type: [ServiceResponseDto] })
  async getServices(
    @Query('includeInactive') includeInactive?: string,
  ) {
    const include = includeInactive === 'true';
    return this.landingService.getServices(include);
  }

  @Get('services/:id')
  @ApiOperation({ summary: '[ADMIN] Obtener servicio por ID' })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado.' })
  async getServiceById(@Param('id') id: string) {
    return this.landingService.getServiceById(id);
  }

  @Post('services')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[ADMIN] Crear servicio' })
  @ApiResponse({ status: 201, type: ServiceResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  async createService(@Body() dto: CreateServiceDto) {
    return this.landingService.createService(dto);
  }

  @Patch('services/:id')
  @ApiOperation({ summary: '[ADMIN] Actualizar servicio (PATCH parcial)' })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado.' })
  async updateService(@Param('id') id: string, @Body() dto: UpdateServiceDto) {
    return this.landingService.updateService(id, dto);
  }

  @Delete('services/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN] Desactivar servicio (soft delete)',
  })
  @ApiResponse({ status: 200, type: ServiceResponseDto })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado.' })
  async deactivateService(@Param('id') id: string) {
    return this.landingService.deactivateService(id);
  }

  // --- GALERÍA ---

  @Get('gallery')
  @ApiOperation({ summary: '[ADMIN] Listar galería' })
  @ApiResponse({ status: 200, type: [GalleryItemResponseDto] })
  async getGallery() {
    return this.landingService.getGallery();
  }

  @Get('gallery/:id')
  @ApiOperation({ summary: '[ADMIN] Obtener elemento de galería por ID' })
  @ApiResponse({ status: 200, type: GalleryItemResponseDto })
  @ApiResponse({ status: 404, description: 'Elemento no encontrado.' })
  async getGalleryItemById(@Param('id') id: string) {
    return this.landingService.getGalleryItemById(id);
  }

  @Post('gallery')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[ADMIN] Añadir imagen a la galería' })
  @ApiResponse({ status: 201, type: GalleryItemResponseDto })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  async createGalleryItem(@Body() dto: CreateGalleryItemDto) {
    return this.landingService.createGalleryItem(dto);
  }

  @Delete('gallery/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '[ADMIN] Eliminar imagen de la galería' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404, description: 'Elemento no encontrado.' })
  async deleteGalleryItem(@Param('id') id: string): Promise<void> {
    await this.landingService.deleteGalleryItem(id);
  }

  // --- AUDITORÍA ---

  @Get('audit-logs')
  @ApiOperation({
    summary: '[ADMIN] Listar audit logs del módulo landing-admin',
    description: 'Historial de quién hizo qué, cuándo y qué cambió. Paginación y filtros por entity o adminId.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Página (1-based)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Tamaño de página (1-100)' })
  @ApiQuery({ name: 'entity', required: false, type: String, description: 'Filtrar por entidad (LandingConfig, Barber, Service, GalleryItem)' })
  @ApiQuery({ name: 'adminId', required: false, type: String, description: 'Filtrar por ID del admin' })
  @ApiResponse({ status: 200, description: 'Lista paginada de audit logs.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo ADMIN.' })
  async getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.auditService.findMany({
      page: query.page,
      limit: query.limit,
      entity: query.entity,
      adminId: query.adminId,
    });
  }
}
