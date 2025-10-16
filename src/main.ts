import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as swaggerUiDist from 'swagger-ui-dist';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Serve static assets from /public (logos, images)
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Security Best Practices
  app.use(helmet());
  app.enableCors({
    origin: true, // Configure this based on your frontend URLs
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip away properties that do not have any decorators
      forbidNonWhitelisted: true, // Throw an error if non-whitelisted values are provided
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API Prefix
  app.setGlobalPrefix('api');

  // Swagger (OpenAPI) Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('eChanneling - Authentication API')
    .setDescription(
      'API documentation for the eChanneling authentication microservice. Supports email/password login, mobile OTP login, and OAuth (Google, Azure AD).',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'Authentication endpoints')
    .addTag('Users', 'User management endpoints')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  // Serve swagger-ui static assets from the swagger-ui-dist package so that
  // Vercel serverless environments (or other bundlers) can find the CSS/JS
  // files at /api/docs/swagger-ui.css, /api/docs/swagger-ui-bundle.js, etc.
  const swaggerDistPath = swaggerUiDist.getAbsoluteFSPath();
  app.useStaticAssets(swaggerDistPath, { prefix: '/api/docs' });

  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
