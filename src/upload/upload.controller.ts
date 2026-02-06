import {
  BadRequestException,
  Controller,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { ROLES } from '../auth/constants/roles';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UPLOAD } from './constants/upload.constants';

@ApiTags('upload')
@Controller('upload')
@UseGuards(RolesGuard)
@Roles(ROLES.ADMIN)
@ApiBearerAuth('access_token')
export class UploadController {

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: UPLOAD.MAX_FILE_SIZE },
      storage: diskStorage({
        destination: (req, file, cb) => {
          const { join } = require('path');
          const { existsSync, mkdirSync } = require('fs');
          const dir = join(process.cwd(), 'uploads');
          if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const ext = ['.jpg', '.jpeg', '.png', '.webp'].includes(extname(file.originalname).toLowerCase())
            ? extname(file.originalname).toLowerCase()
            : '.jpg';
          cb(null, `${randomUUID()}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (UPLOAD.ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof UPLOAD.ALLOWED_MIME_TYPES)[number])) {
          cb(null, true);
        } else {
          cb(new BadRequestException(`Tipo no permitido. Use: ${UPLOAD.ALLOWED_MIME_TYPES.join(', ')}`), false);
        }
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Imagen (jpg, png, webp, máx. 5 MB)' },
      },
      required: ['file'],
    },
  })
  @ApiOperation({
    summary: '[ADMIN] Subir imagen',
    description: 'Sube una imagen y devuelve la URL pública. Usar para hero, logo, about, barberos, galería. Máx. 5 MB. Formatos: jpg, png, webp.',
  })
  @ApiResponse({
    status: 201,
    description: 'Imagen subida. Devuelve la URL pública.',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: 'http://localhost:3000/uploads/abc-123.jpg' },
        filename: { type: 'string', example: 'abc-123.jpg' },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Archivo inválido (tipo, tamaño).' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 403, description: 'Solo ADMIN.' })
  async uploadImage(@Req() req: Request & { file?: Express.Multer.File }) {
    const file = req.file;
    if (!file) {
      throw new BadRequestException('No se recibió ningún archivo. Envíe el campo "file" en multipart/form-data.');
    }

    const baseUrl = process.env.BASE_URL ?? `${req.protocol}://${req.get('host')}`;
    const url = `${baseUrl}/uploads/${file.filename}`;

    return {
      url,
      filename: file.filename,
    };
  }
}
