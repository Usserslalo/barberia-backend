import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 1. Prefijo global para todas las rutas (opcional pero recomendado)
  // Ahora todas tus APIs empezarán con http://localhost:3000/api/...
  app.setGlobalPrefix('api');

  // 2. Configuración de ValidationPipe
  // Esto hace que NestJS valide automáticamente los datos que llegan (DTOs)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 3. Configuración de Swagger
  const config = new DocumentBuilder()
    .setTitle('NestJS Auth Boilerplate API')
    .setDescription('API de autenticación y seguridad: JWT, OTP por WhatsApp, RBAC y rate limiting. Boilerplate genérico y reutilizable para proyectos de autenticación.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access_token',
    )
    .addTag('auth', 'Endpoints para autenticación y seguridad de grado empresarial')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document); // La documentación estará en /docs

  await app.listen(process.env.PORT ?? 3000);
  console.log(`🚀 Servidor corriendo en: http://localhost:3000/api`);
  console.log(`📄 Documentación disponible en: http://localhost:3000/docs`);
}
bootstrap();