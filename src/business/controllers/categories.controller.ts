import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import { CreateServiceCategoryDto } from '../dto/create-service-category.dto';
import { UpdateServiceCategoryDto } from '../dto/update-service-category.dto';
import type { ServiceCategory } from '@prisma/client';

@ApiTags('business')
@Controller('business/categories')
@UseGuards(RolesGuard)
@Roles(ROLES.ADMIN)
@ApiBearerAuth('access_token')
export class CategoriesController {
  constructor(private readonly businessService: BusinessService) {}

  @Get()
  @ApiOperation({ summary: '[ADMIN] Listar categorías de servicio' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    type: Boolean,
    description: 'Incluir categorías inactivas',
  })
  @ApiResponse({ status: 200, description: 'Lista de categorías' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo ADMIN.' })
  async getCategories(
    @Query('includeInactive') includeInactive?: string,
  ): Promise<ServiceCategory[]> {
    const include = includeInactive === 'true';
    return this.businessService.getCategories(include);
  }

  @Get(':id')
  @ApiOperation({ summary: '[ADMIN] Obtener categoría por ID' })
  @ApiResponse({ status: 200, description: 'Categoría' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  async getCategoryById(@Param('id') id: string): Promise<ServiceCategory> {
    return this.businessService.getCategoryById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '[ADMIN] Crear categoría de servicio' })
  @ApiResponse({ status: 201, description: 'Categoría creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos.' })
  @ApiResponse({ status: 409, description: 'Slug ya existe.' })
  async createCategory(@Body() dto: CreateServiceCategoryDto): Promise<ServiceCategory> {
    return this.businessService.createCategory(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '[ADMIN] Actualizar categoría (PATCH parcial)' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  @ApiResponse({ status: 409, description: 'Slug ya existe.' })
  async updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdateServiceCategoryDto,
  ): Promise<ServiceCategory> {
    return this.businessService.updateCategory(id, dto);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: '[ADMIN] Desactivar categoría (soft)' })
  @ApiResponse({ status: 200, description: 'Categoría desactivada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada.' })
  async deactivateCategory(@Param('id') id: string): Promise<ServiceCategory> {
    return this.businessService.deactivateCategory(id);
  }
}
