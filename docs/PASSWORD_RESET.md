# Password Reset Feature - Implementation Guide

## Overview
Complete forgot password and reset password flow with OTP verification for the eChanneling authentication service.

## Flow Diagram
```
User requests reset → OTP sent to email → User enters OTP + new password → Password updated
```

## New Endpoints

### 1. POST /api/auth/forgot-password
Request a password reset OTP to be sent to the user's email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (Success):**
```json
{
  "message": "Password reset OTP sent successfully to your email",
  "email": "us***r@example.com"
}
```

**Security Features:**
- Does not reveal if the email exists in the system (prevents email enumeration)
- Rate limited to 3 requests per minute
- 60 second cooldown between OTP requests
- OTP expires after 5 minutes (configurable in .env)

### 2. POST /api/auth/reset-password
Reset password using the OTP received via email.

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "new_password": "NewSecurePass123!",
  "confirm_password": "NewSecurePass123!"
}
```

**Response (Success):**
```json
{
  "message": "Password reset successfully. You can now login with your new password."
}
```

**Password Requirements:**
- Minimum 8 characters
- Must contain uppercase letter
- Must contain lowercase letter
- Must contain number
- Must contain special character

**Security Features:**
- OTP must match and not be expired
- Maximum 5 attempts per OTP (then OTP is deleted)
- Rate limited to 5 requests per minute
- Passwords must match
- OTP is deleted after successful password reset
- Password is hashed with bcrypt (10 rounds) before storage

## Testing Commands

### Test Forgot Password Flow

**Step 1: Request Password Reset**
```powershell
curl -X POST "http://localhost:3001/api/auth/forgot-password" `
  -H "Content-Type: application/json" `
  -d '{"email":"user@example.com"}'
```

Expected: 200 OK, check email for OTP code

**Step 2: Reset Password with OTP**
```powershell
curl -X POST "http://localhost:3001/api/auth/reset-password" `
  -H "Content-Type: application/json" `
  -d '{
    "email":"user@example.com",
    "otp":"123456",
    "new_password":"NewPass123!",
    "confirm_password":"NewPass123!"
  }'
```

Expected: 200 OK with success message

**Step 3: Login with New Password**
```powershell
curl -X POST "http://localhost:3001/api/auth/login" `
  -H "Content-Type: application/json" `
  -d '{
    "email":"user@example.com",
    "password":"NewPass123!"
  }'
```

Expected: 200 OK with JWT token

## Email Template
The password reset email includes:
- eChanneling branding with logo
- Clear OTP display (large, centered, easy to read)
- Expiry time information
- Security warning (don't share OTP)
- Professional styling matching other email templates

## Files Created/Modified

### New Files:
1. `src/auth/dto/request-password-reset.dto.ts` - DTO for forgot password request
2. `src/auth/dto/reset-password.dto.ts` - DTO for password reset with validation

### Modified Files:
1. `src/auth/services/auth.service.ts`
   - Added `requestPasswordReset()` method
   - Added `resetPassword()` method

2. `src/auth/controllers/auth.controller.ts`
   - Added POST `/forgot-password` endpoint
   - Added POST `/reset-password` endpoint

3. `src/mail/mail.service.ts`
   - Added `sendPasswordResetEmail()` method with branded template

## Error Handling

### Common Errors:

**429 Too Many Requests**
```json
{
  "statusCode": 429,
  "message": "Please wait 45 seconds before requesting a new OTP"
}
```

**400 Bad Request (Passwords Don't Match)**
```json
{
  "statusCode": 400,
  "message": "Passwords do not match"
}
```

**400 Bad Request (Weak Password)**
```json
{
  "statusCode": 400,
  "message": [
    "Password must be at least 8 characters long",
    "Password must contain uppercase, lowercase, number and special character"
  ]
}
```

**401 Unauthorized (Invalid OTP)**
```json
{
  "statusCode": 401,
  "message": "Invalid OTP"
}
```

**401 Unauthorized (Expired OTP)**
```json
{
  "statusCode": 401,
  "message": "OTP has expired. Please request a new one."
}
```

**401 Unauthorized (Too Many Attempts)**
```json
{
  "statusCode": 401,
  "message": "Too many failed attempts. Please request a new OTP."
}
```

## Security Considerations

1. **Email Enumeration Prevention**: The forgot password endpoint returns the same message whether the email exists or not
2. **Rate Limiting**: Both endpoints are rate-limited to prevent abuse
3. **OTP Expiry**: OTPs expire after 5 minutes
4. **Attempt Limiting**: Maximum 5 attempts per OTP before it's deleted
5. **Cooldown Period**: 60 seconds between OTP requests
6. **Secure Password Hashing**: bcrypt with 10 salt rounds
7. **Strong Password Policy**: Enforced via validation decorators
8. **OTP Cleanup**: OTPs are deleted after successful use or expiry

## Configuration (.env)

The password reset feature uses these environment variables:

```env
# OTP Configuration
OTP_EXPIRY_MINUTES=5          # How long OTP is valid
OTP_COOLDOWN_SECONDS=60       # Wait time between OTP requests

# Email Configuration
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@echanneling.com
```

## Integration with Existing Features

The password reset flow integrates seamlessly with:
- Existing OTP infrastructure (reuses `otps` table)
- Mail service (same transporter and styling)
- Rate limiting (same throttler configuration)
- Validation pipeline (same class-validator setup)

## API Documentation

Both endpoints are automatically documented in Swagger UI at:
```
http://localhost:3001/api/docs
```

Look for the "Authentication" section to find:
- POST /api/auth/forgot-password
- POST /api/auth/reset-password

## Next Steps

1. **Test the flow end-to-end:**
   - Request reset for a real email
   - Check inbox for OTP email
   - Use OTP to reset password
   - Login with new password

2. **Optional enhancements:**
   - Add password history (prevent reusing last N passwords)
   - Add account lockout after multiple failed reset attempts
   - Add notification email when password is changed
   - Add option to reset via SMS/phone OTP

3. **Production considerations:**
   - Use a professional email service (SendGrid, AWS SES)
   - Monitor OTP usage patterns for abuse
   - Set up email delivery monitoring
   - Consider 2FA for additional security

## Troubleshooting

**Email not sending?**
- Check EMAIL_USER and EMAIL_PASS in .env
- Verify Gmail app password is correct
- Check logs for email errors: `npm run start:dev`

**OTP not working?**
- Ensure database tables are created (run database-setup.sql)
- Check OTP hasn't expired (5 minute default)
- Verify you haven't exceeded 5 attempts

**Password validation failing?**
- Password must be at least 8 characters
- Must include: uppercase, lowercase, number, special character
- Example valid password: `MyPass123!`
