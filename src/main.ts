import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as swaggerUiDist from 'swagger-ui-dist';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  // JWT refresh secret checks
  try {
    const jwtSecret = configService.get<string>('jwt.secret');
    const refreshSecret = configService.get<string>('jwt.refreshSecret');

    // JWT_SECRET presence & strength checks
    if (!jwtSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET must be set in production and must be a strong secret');
      } else {
        console.warn('Warning: JWT_SECRET not set - using default placeholder (not recommended)');
      }
    } else {
      if ((jwtSecret || '').length < 32) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET should be at least 32 characters long');
        } else {
          console.warn('Warning: JWT_SECRET is shorter than 32 characters - consider increasing its length');
        }
      }

      if (jwtSecret.includes('change') || jwtSecret.includes('your-super')) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('JWT_SECRET appears to be a placeholder value. Set a securely generated secret in production');
        } else {
          console.warn('Warning: JWT_SECRET looks like the default placeholder - consider replacing it with a strong secret');
        }
      }
    }

    if (!refreshSecret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_REFRESH_SECRET must be set in production and should be different from JWT_SECRET');
      } else {
        console.warn('Warning: JWT_REFRESH_SECRET not set - using JWT_SECRET as fallback (not recommended for production)');
      }
    } else {
      if (refreshSecret === jwtSecret) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('JWT_REFRESH_SECRET must be different from JWT_SECRET');
        } else {
          console.warn('Warning: JWT_REFRESH_SECRET is the same as JWT_SECRET - consider changing it to a distinct, strong secret');
        }
      }

      if ((refreshSecret || '').length < 32) {
        if (process.env.NODE_ENV === 'production') {
          throw new Error('JWT_REFRESH_SECRET should be at least 32 characters long');
        } else {
          console.warn('Warning: JWT_REFRESH_SECRET is shorter than 32 characters - consider increasing its length');
        }
      }
    }
  } catch (err) {
    // Surface startup errors
    console.error('JWT refresh secret validation error:', err.message || err);
    throw err;
  }

  // Serve static assets from /public (logos, images)
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Security Best Practices with CSP adjustment for Swagger
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Swagger
          scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for Swagger
          imgSrc: ["'self'", 'data:', 'https:'], // Allow images from CDN
          connectSrc: ["'self'"], // Only allow connections to same origin
        },
      },
    }),
  );
  // CORS - soft-fail in production if FRONTEND_URLS not provided
  const frontendOrigins = process.env.FRONTEND_URLS || process.env.FRONTEND_URL;
  const allowedOrigins = frontendOrigins
    ? frontendOrigins.split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  if (process.env.NODE_ENV === 'production' && !frontendOrigins) {
    console.warn(
      '⚠️ FRONTEND_URLS not set. Defaulting to same-origin only. Cross-origin requests will be blocked until origins are configured.',
    );
  }

  if (process.env.ALLOW_ALL_ORIGINS === 'true') {
    app.enableCors({ origin: true, credentials: true });
  } else {
    app.enableCors({
      credentials: true,
      origin: (origin, callback) => {
        // Allow non-browser requests (curl, server-to-server, health checks)
        if (!origin) {
          return callback(null, true);
        }

        // If no origins configured yet → block cross-origin
        if (allowedOrigins.length === 0) {
          return callback(new Error('CORS blocked for origin: ' + origin), false);
        }

        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(new Error('CORS blocked for origin: ' + origin), false);
      },
    });
  }

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
  app.useStaticAssets(swaggerUiDist.getAbsoluteFSPath(), {
    prefix: '/api/docs-static',
  });

  // Only setup the JSON endpoint (custom controller serves HTML)
  // This makes /api/docs-json available for our custom Swagger UI
  app.use('/api/docs-json', (req, res) => {
    res.json(document);
  });

  // Enable cookie parsing for refresh token cookie support
  const cookieParser = require('cookie-parser');
  app.use(cookieParser());

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Application is running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
