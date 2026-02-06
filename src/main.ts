import 'dotenv/config';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 0. Cookie parser (para refresh token HttpOnly)
  app.use(cookieParser());

  // 1. Filtro global de excepciones (formato estándar de errores)
  app.useGlobalFilters(new HttpExceptionFilter());

  // 2. Archivos estáticos: /uploads para imágenes subidas
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // 3. CORS: en producción definir CORS_ORIGIN o CORS_ORIGINS con la URL del frontend para permitir peticiones externas.
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : process.env.CORS_ORIGIN?.trim()
      ? [process.env.CORS_ORIGIN.trim()]
      : ['http://localhost:4200'];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // peticiones sin origin (Postman, same-origin)
      if (corsOrigins.includes(origin)) return callback(null, true);
      callback(null, false); // origen no autorizado (anti-leeching)
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // 4. Prefijo global para todas las rutas (opcional pero recomendado)
  // Ahora todas tus APIs empezarán con http://localhost:3000/api/...
  app.setGlobalPrefix('api');

  // 4.1 Health check en raíz para Render/plataformas (GET / y HEAD / → 200)
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get('/', (_req, res) => res.status(200).json({ status: 'ok' }));
  httpAdapter.head('/', (_req, res) => res.status(200).end());

  // 5. Configuración de ValidationPipe
  // Esto hace que NestJS valide automáticamente los datos que llegan (DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 6. Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('NestJS Auth Boilerplate API')
    .setDescription('API de autenticación y seguridad: JWT, OTP por WhatsApp, RBAC y rate limiting. Boilerplate genérico y reutilizable para proyectos de autenticación.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access_token',
    )
    .addTag('auth', 'Endpoints para autenticación y seguridad de grado empresarial')
    .addTag('landing', 'Datos públicos del landing (Hero, About, Barberos, Servicios, Galería)')
    .addTag('landing-admin', 'Panel de administración del landing (solo rol ADMIN)')
    .addTag('business', 'Gestión de negocio: categorías de servicio, horarios de barberos, excepciones de calendario (solo ADMIN)')
    .addTag('appointments', 'Citas: slots disponibles para reservar (público)')
    .addTag('upload', 'Subida de imágenes (solo rol ADMIN)')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // La documentación estará en /docs

  const port = Number(process.env.PORT) || 3000;
  await app.listen(port);
  let host: string;
  try {
    host = process.env.BASE_URL ? new URL(process.env.BASE_URL).origin : `http://localhost:${port}`;
  } catch {
    host = `http://localhost:${port}`;
  }
  console.log(`🚀 Servidor corriendo en: ${host}/api`);
  console.log(`📄 Documentación disponible en: ${host}/docs`);
}
bootstrap();