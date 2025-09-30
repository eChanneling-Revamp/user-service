import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import * as express from 'express';
import * as swaggerUi from 'swagger-ui-express';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

async function bootstrap() {
  dotenv.config({ path: '../../.env' });
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(process.env.API_PREFIX || '/api');
  // Serve Swagger UI at /docs using the pre-built OpenAPI YAML
  const server = app.getHttpAdapter().getInstance() as express.Express;
  server.use(cookieParser());
  try {
    const docPath = require('path').resolve(__dirname, '..', '..', 'openapi', 'user-service.yaml');
    const yamlContent = fs.readFileSync(docPath, 'utf8');
    const swaggerDocument = yaml.load(yamlContent) as object;
    server.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
    // Redirect root to docs for convenience
    server.get('/', (_req, res) => res.redirect('/docs'));
  } catch (err: unknown) {
    // If swagger file not found, do nothing (app continues without docs)
    const msg = (err && typeof err === 'object' && 'message' in err) ? (err as any).message : String(err);
    console.warn('Could not load OpenAPI yaml for Swagger UI:', msg);
  }
  await app.listen(process.env.PORT ? Number(process.env.PORT) : 3002);
  console.info(`User service listening on ${process.env.PORT || 3002}`);
}
bootstrap();
