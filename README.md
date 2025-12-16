# Channeling Service - Authentication Microservice

A comprehensive NestJS-based authentication microservice for the Channeling Service platform. This service provides secure user authentication with support for multiple login methods including email/password, mobile OTP, and OAuth (Google & Azure AD).

## 🚀 Features

- **Multi-method Authentication**
  - Email/Password login (Web)
  - Phone Number + OTP login (Mobile)
  - Google OAuth 2.0
  - Azure AD OAuth
  
- **Role-Based Access Control (RBAC)**
  - 6 User Roles: `super_admin`, `admin`, `hospital`, `doctor`, `nurse`, `patient`
  - Granular permissions based on role hierarchy
  
- **Security Features**
  - JWT token-based authentication
  - Password hashing with bcrypt
  - Rate limiting on sensitive endpoints
  - Helmet for HTTP security headers
  - CORS enabled
  - Input validation with class-validator
  
- **OTP Management**
  - Configurable expiry time
  - Rate limiting with cooldown period
  - Secure email delivery
  - Attempt limiting
  
- **API Documentation**
  - Interactive Swagger/OpenAPI docs
  - Comprehensive endpoint descriptions
  - Request/Response examples

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project
- Gmail account (for OTP emails) with App Password
- Google OAuth credentials (optional)
- Azure AD OAuth credentials (optional)

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd user-service
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy `.env.example` to `.env`:

```bash
copy .env.example .env
```

Update the `.env` file with your credentials:

```env
# Application
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:3001

# Supabase
SUPABASE_URL=your-supabase-url
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-in-production-minimum-32-characters-long
JWT_EXPIRATION=24h
# Refresh token configuration (optional - recommended)
JWT_REFRESH_SECRET=another-super-secret-key
JWT_REFRESH_EXPIRATION=7d

**Integration guide:** See `docs/AUTH-INTEGRATION.md` for a step-by-step guide on endpoints, web & mobile integration, CSRF handling, code examples for Next.js and React, and deployment checklist.

**Local token verification utility:**

A small helper script is available to decode and verify JWTs locally using your `.env` values:

```
# Verify a JWT with env secrets (looks for JWT_SECRET & JWT_REFRESH_TOKEN_SECRET):
npm run verify:jwt -- --token <JWT> --use-env

# Verify with an explicit secret:
npm run verify:jwt -- --token <JWT> --secret "your-secret-here"
```

This utility is intended for local development and debugging only. Do NOT expose token verification endpoints in production.

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# Azure AD OAuth
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_TENANT_ID=your-azure-tenant-id
AZURE_AD_CLIENT_SECRET=your-azure-client-secret
AZURE_AD_CALLBACK_URL=http://localhost:3000/api/auth/azure/callback

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_FROM=noreply@channelingservice.com

# OTP Configuration
OTP_EXPIRY_MINUTES=5
OTP_COOLDOWN_SECONDS=60
```

## 🗄️ Database Setup

### Supabase Tables

Create the following tables in your Supabase project:

#### 1. Users Table

```sql
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'hospital', 'doctor', 'nurse', 'patient')),
  age INTEGER,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_role ON users(role);

### Running DB migrations locally or on your DB

This project includes a simple migration runner that applies SQL files placed in `db/migrations/` (ordered by filename) and records applied migrations in a `migrations` table.

Quick steps:

1. Ensure you have a Postgres connection string available as `DATABASE_URL` in your environment (e.g., `postgres://user:pass@host:5432/dbname`).
2. Run the migrations with the npm script:

```bash
DATABASE_URL="postgres://user:pass@host:5432/dbname" npm run migrate
```

If you don't have direct DB access (e.g., you use Supabase), you can open each `.sql` file in `db/migrations/` and run them in the Supabase SQL Editor.

Note: The migration runner will create and use a `migrations` table to avoid reapplying the same file.

```

#### 2. OTPs Table

```sql
CREATE TABLE otps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  otp TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  attempts INTEGER DEFAULT 0
);

-- Create index for email lookups
CREATE INDEX idx_otps_email ON otps(email);

#### 3. Refresh Tokens Table

```sql
CREATE TABLE refresh_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
```

-- Auto-delete expired OTPs (optional but recommended)
CREATE OR REPLACE FUNCTION delete_expired_otps()
RETURNS void AS $$
BEGIN
  DELETE FROM otps WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule to run every 5 minutes
SELECT cron.schedule('delete-expired-otps', '*/5 * * * *', 'SELECT delete_expired_otps()');
```

#### 3. Enable Row Level Security (RLS)

For better security, enable RLS on your tables:

```sql
-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE otps ENABLE ROW LEVEL SECURITY;

-- Create policies (customize based on your needs)
-- Allow service role to do everything
CREATE POLICY "Service role can do everything on users" ON users
  FOR ALL USING (true);

CREATE POLICY "Service role can do everything on otps" ON otps
  FOR ALL USING (true);
```

## 🚦 Running the Application

### Development Mode

```bash
npm run start:dev
```

The application will start on `http://localhost:3000`

### Production Mode

```bash
# Build the application
npm run build

# Start production server
npm run start:prod
```

### API Documentation

Once the application is running, access the interactive Swagger documentation at:

```
http://localhost:3000/api/docs
```

## 📖 API Endpoints

### Authentication Endpoints

#### Register User
- **POST** `/api/auth/register`
- Public endpoint
- Body: `{ first_name, last_name, email, password, confirm_password, phone_number, role, age?, gender? }`
- Note: Cannot register with `admin` or `super_admin` roles

#### Login (Email/Password)
- **POST** `/api/auth/login`
- Public endpoint
- Body: `{ email, password }`
- Returns: `{ message, user, token }`

#### Send OTP (Mobile)
- **POST** `/api/auth/send-otp`
- Public endpoint
- Body: `{ phone_number }`
- Sends OTP to user's registered email

#### Verify OTP (Mobile)
- **POST** `/api/auth/verify-otp`
- Public endpoint
- Body: `{ phone_number, otp }`
- Returns: `{ message, user, token }`

#### Google OAuth
- **GET** `/api/auth/google`
- Initiates Google OAuth flow

- **GET** `/api/auth/google/callback`
- Google OAuth callback

#### Azure AD OAuth
- **GET** `/api/auth/azure`
- Initiates Azure AD OAuth flow

- **GET** `/api/auth/azure/callback`
- Azure AD OAuth callback

### User Management Endpoints

All user endpoints require JWT authentication via `Authorization: Bearer <token>` header.

#### Get Current User Profile
- **GET** `/api/users/me`
- Returns current user's profile

#### List All Users
- **GET** `/api/users`
- Requires: `admin` or `super_admin` role
- SuperAdmin sees: admin, hospital, doctor, nurse, patient
- Admin sees: hospital, doctor, nurse, patient

#### Get Users by Role
- **GET** `/api/users/role/:role`
- Requires: `admin` or `super_admin` role
- Returns users with specified role (respecting RBAC)

#### Get Statistics
- **GET** `/api/users/statistics`
- Requires: `admin` or `super_admin` role
- Returns user count by role

## 🔐 Role-Based Access Control

### Role Hierarchy

```
super_admin (highest privileges)
  ├─ Can view: admin, hospital, doctor, nurse, patient
  └─ Can manage system-wide settings

admin
  ├─ Can view: hospital, doctor, nurse, patient
  └─ Can manage organizational settings

hospital
  ├─ Can view: Own profile
  └─ Can manage appointments

doctor
  ├─ Can view: Own profile
  └─ Can manage schedules and patients

nurse
  ├─ Can view: Own profile
  └─ Can assist with patient care

patient (lowest privileges)
  ├─ Can view: Own profile
  └─ Can book appointments
```

### Protected Endpoints

To protect an endpoint with role-based access:

```typescript
@Get('admin-only')
@Roles(Role.Admin, Role.SuperAdmin)
async adminOnlyEndpoint() {
  // Only accessible by admin and super_admin
}
```

## 🔒 Security Best Practices

### Implemented Security Measures

1. **JWT Authentication**: All protected endpoints require valid JWT tokens
2. **Password Hashing**: Passwords are hashed using bcrypt (salt rounds: 10)
3. **Rate Limiting**: Sensitive endpoints have rate limits
   - Login: 5 attempts/minute
   - Send OTP: 3 attempts/minute
   - Verify OTP: 5 attempts/minute
4. **Input Validation**: All inputs are validated using class-validator
5. **CORS**: Configured to accept requests from trusted origins
6. **Helmet**: Security headers are automatically set
7. **OTP Security**:
   - 5-minute expiration
   - 60-second cooldown between requests
   - Maximum 5 verification attempts

### Recommended Production Configurations

1. **Environment Variables**:
   - Use strong, randomly generated JWT secrets (min 32 characters)
   - Never commit `.env` file to version control
   - Use environment-specific configurations

2. **HTTPS**:
   - Always use HTTPS in production
   - Configure proper SSL certificates

3. **Database**:
   - Enable Row Level Security (RLS) on Supabase
   - Use connection pooling
   - Regular backups

4. **Monitoring**:
   - Implement logging (Winston, Pino)
   - Set up error tracking (Sentry)
   - Monitor API performance

## 📧 Email Configuration

### Gmail Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security
   - Select "2-Step Verification"
   - At the bottom, select "App passwords"
   - Generate a password for "Mail"
3. Use this app password in `EMAIL_PASS` environment variable

### Custom SMTP

To use a different email provider, modify `src/mail/mail.service.ts`:

```typescript
this.transporter = nodemailer.createTransport({
  host: 'your-smtp-host.com',
  port: 587,
  secure: false,
  auth: {
    user: 'your-email@domain.com',
    pass: 'your-password',
  },
});
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📁 Project Structure

```
src/
├── auth/                     # Authentication module
│   ├── controllers/          # Auth endpoints
│   ├── services/             # Auth business logic
│   ├── strategies/           # Passport strategies (JWT, Google, Azure)
│   ├── guards/               # Auth guards (JWT, Roles, OAuth)
│   ├── dto/                  # Data Transfer Objects
│   └── auth.module.ts
│
├── users/                    # User management module
│   ├── controllers/          # User endpoints
│   ├── services/             # User business logic
│   └── users.module.ts
│
├── mail/                     # Email service module
│   ├── mail.service.ts       # Email sending logic
│   └── mail.module.ts
│
├── database/                 # Database module
│   ├── database.module.ts
│   └── supabase.provider.ts  # Supabase client
│
├── common/                   # Shared utilities
│   ├── decorators/           # Custom decorators
│   ├── enums/                # Enums (roles, etc.)
│   └── interfaces/           # TypeScript interfaces
│
├── config/                   # Configuration
│   └── configuration.ts      # Environment config
│
├── app.module.ts             # Root module
└── main.ts                   # Application entry point
```

## 🐛 Troubleshooting

### Common Issues

1. **"Cannot find module" errors**
   - Run `npm install` to ensure all dependencies are installed
   - Delete `node_modules` and `package-lock.json`, then reinstall

2. **Supabase connection errors**
   - Verify your Supabase URL and keys in `.env`
   - Check if your IP is allowed in Supabase settings
   - Ensure tables are created correctly

3. **Email not sending**
   - Verify Gmail App Password is correct
   - Check if 2FA is enabled on Gmail
   - Review email service logs in console

4. **JWT errors**
   - Ensure JWT_SECRET is set and matches across services
   - Check token expiration time
   - Verify Bearer token format in Authorization header

## 📝 License

MIT

## 👥 Support

For issues and questions:
- Create an issue on GitHub
- Contact the development team
- Check the Swagger documentation at `/api/docs`

## 🎯 Future Enhancements

- [ ] Email verification on registration
- [ ] Password reset functionality
- [ ] Multi-factor authentication (MFA)
- [ ] Session management
- [ ] User profile image upload
- [ ] Audit logging
- [ ] WebSocket support for real-time notifications
- [ ] Redis caching for OTPs
- [ ] Docker containerization
- [ ] CI/CD pipeline setup
