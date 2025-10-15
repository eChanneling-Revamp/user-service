# Deployment Guide - Channeling Service Authentication API

This guide covers deploying the authentication microservice to various platforms.

## 📦 Pre-Deployment Checklist

- [ ] All environment variables configured
- [ ] Database tables created in Supabase
- [ ] JWT secret generated (minimum 32 characters)
- [ ] Email service configured and tested
- [ ] OAuth credentials obtained (if using Google/Azure)
- [ ] CORS origins configured for production
- [ ] SSL/TLS certificates ready (for HTTPS)
- [ ] Monitoring and logging configured

## 🚀 Deployment Options

### Option 1: Deploy to Heroku

#### 1. Install Heroku CLI
```bash
npm install -g heroku
```

#### 2. Login to Heroku
```bash
heroku login
```

#### 3. Create Heroku App
```bash
heroku create channeling-auth-service
```

#### 4. Set Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set PORT=3000
heroku config:set SUPABASE_URL=your-supabase-url
heroku config:set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
heroku config:set JWT_SECRET=your-jwt-secret
heroku config:set EMAIL_USER=your-email@gmail.com
heroku config:set EMAIL_PASS=your-app-password
# ... set all other env variables
```

#### 5. Deploy
```bash
git push heroku main
```

#### 6. Scale Dynos
```bash
heroku ps:scale web=1
```

---

### Option 2: Deploy to AWS (Elastic Beanstalk)

#### 1. Install EB CLI
```bash
pip install awsebcli
```

#### 2. Initialize EB Application
```bash
eb init -p node.js channeling-auth-service --region us-east-1
```

#### 3. Create Environment
```bash
eb create production-env
```

#### 4. Set Environment Variables
```bash
eb setenv NODE_ENV=production \
  SUPABASE_URL=your-url \
  JWT_SECRET=your-secret \
  # ... all other variables
```

#### 5. Deploy
```bash
eb deploy
```

---

### Option 3: Deploy to Google Cloud Platform (Cloud Run)

#### 1. Build Docker Image
```bash
docker build -t gcr.io/your-project-id/channeling-auth:latest .
```

#### 2. Push to Google Container Registry
```bash
docker push gcr.io/your-project-id/channeling-auth:latest
```

#### 3. Deploy to Cloud Run
```bash
gcloud run deploy channeling-auth-service \
  --image gcr.io/your-project-id/channeling-auth:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,SUPABASE_URL=your-url,JWT_SECRET=your-secret"
```

---

### Option 4: Deploy to Azure (App Service)

#### 1. Create Azure App Service
```bash
az webapp create \
  --resource-group your-resource-group \
  --plan your-app-service-plan \
  --name channeling-auth-service \
  --runtime "NODE|18-lts"
```

#### 2. Configure Environment Variables
```bash
az webapp config appsettings set \
  --resource-group your-resource-group \
  --name channeling-auth-service \
  --settings NODE_ENV=production SUPABASE_URL=your-url JWT_SECRET=your-secret
```

#### 3. Deploy
```bash
az webapp deployment source config-zip \
  --resource-group your-resource-group \
  --name channeling-auth-service \
  --src ./dist.zip
```

---

### Option 5: Deploy to DigitalOcean (App Platform)

#### 1. Create app.yaml
```yaml
name: channeling-auth-service
services:
  - name: api
    github:
      repo: your-username/user-service
      branch: main
    build_command: npm run build
    run_command: npm run start:prod
    envs:
      - key: NODE_ENV
        value: production
      - key: SUPABASE_URL
        value: ${SUPABASE_URL}
      - key: JWT_SECRET
        value: ${JWT_SECRET}
    http_port: 3000
```

#### 2. Deploy via CLI
```bash
doctl apps create --spec app.yaml
```

---

## 🐳 Docker Deployment

### Create Dockerfile

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/main"]
```

### Create .dockerignore

```
node_modules
dist
npm-debug.log
.env
.git
.gitignore
README.md
.vscode
```

### Build and Run

```bash
# Build
docker build -t channeling-auth:latest .

# Run
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e SUPABASE_URL=your-url \
  -e JWT_SECRET=your-secret \
  channeling-auth:latest
```

### Docker Compose

```yaml
version: '3.8'

services:
  auth-service:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## 🔐 Security Best Practices for Production

### 1. Environment Variables
- Use secure vaults (AWS Secrets Manager, Azure Key Vault, etc.)
- Never commit `.env` files
- Rotate secrets regularly

### 2. HTTPS/SSL
```typescript
// main.ts - Force HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

### 3. Rate Limiting
```typescript
// Increase rate limiting for production
ThrottlerModule.forRoot([{
  ttl: 60000,
  limit: 100, // More lenient for production
}])
```

### 4. CORS Configuration
```typescript
// Configure specific origins
app.enableCors({
  origin: [
    'https://yourdomain.com',
    'https://app.yourdomain.com'
  ],
  credentials: true,
});
```

### 5. Logging
```typescript
// Use production-grade logger
import * as winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

---

## 📊 Monitoring and Observability

### Health Check Endpoint

Add to `app.controller.ts`:

```typescript
@Get('health')
async healthCheck() {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}
```

### Recommended Monitoring Tools

1. **Application Performance**: New Relic, Datadog
2. **Error Tracking**: Sentry, Rollbar
3. **Logging**: ELK Stack, Loggly, Papertrail
4. **Uptime Monitoring**: Pingdom, UptimeRobot

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2

      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Build
        run: npm run build

      - name: Deploy to Heroku
        uses: akhileshns/heroku-deploy@v3.12.12
        with:
          heroku_api_key: ${{ secrets.HEROKU_API_KEY }}
          heroku_app_name: "channeling-auth-service"
          heroku_email: "your-email@example.com"
```

---

## 📝 Post-Deployment Verification

1. **Test Health Endpoint**
   ```bash
   curl https://your-domain.com/health
   ```

2. **Test Authentication**
   ```bash
   curl -X POST https://your-domain.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test@123"}'
   ```

3. **Verify Swagger Docs**
   ```
   https://your-domain.com/api/docs
   ```

4. **Check Logs**
   ```bash
   # Heroku
   heroku logs --tail

   # AWS
   eb logs

   # Docker
   docker logs <container-id>
   ```

---

## 🆘 Troubleshooting

### Common Issues

1. **502 Bad Gateway**
   - Check if app is listening on correct PORT
   - Verify environment variables are set

2. **Database Connection Failed**
   - Verify Supabase credentials
   - Check network connectivity

3. **Email Not Sending**
   - Verify Gmail App Password
   - Check firewall rules

4. **OAuth Redirect Issues**
   - Update callback URLs in Google/Azure console
   - Check HTTPS configuration

---

## 📞 Support

For deployment issues:
- Check application logs
- Review environment variables
- Verify database connectivity
- Test API endpoints manually
- Contact DevOps team

---

## 🎯 Performance Optimization

1. **Enable Caching**: Use Redis for session/OTP storage
2. **Database Indexing**: Ensure proper indexes on Supabase
3. **Compression**: Enable gzip compression
4. **CDN**: Use CDN for static assets
5. **Load Balancing**: Use multiple instances behind load balancer

---

Last Updated: 2025
