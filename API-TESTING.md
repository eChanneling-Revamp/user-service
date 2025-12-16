# API Testing Guide

This guide provides examples and instructions for testing all API endpoints using various tools.

## 🧪 Testing Tools

- **Swagger UI**: `http://localhost:3000/api/docs` (Recommended for quick testing)
- **Postman**: Import the collection below
- **cURL**: Command-line testing examples provided
- **VS Code REST Client**: Use `.http` file examples

## 📝 Environment Setup

Before testing, ensure:
1. The application is running (`npm run start:dev`)
2. Database tables are created in Supabase
3. Email service is configured

## 🔐 Authentication Flow

### 1. Register a New User

**Endpoint**: `POST /api/auth/register`

**cURL**:
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "password": "Password@123",
    "confirm_password": "Password@123",
    "phone_number": "+94771234567",
    "role": "patient",
    "age": 30,
    "gender": "male"
  }'
```

**Expected Response**:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "uuid-here",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+94771234567",
    "role": "patient",
    "age": 30,
    "gender": "male"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Cases**:
- 400: Passwords don't match
- 400: Cannot register with admin/super_admin role
- 409: User already exists
- 422: Validation errors

---

### 2. Login with Email/Password (Web)

**Endpoint**: `POST /api/auth/login`

**cURL**:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.doe@example.com",
    "password": "Password@123"
  }'
```

**Expected Response**:
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid-here",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "patient"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Cases**:
- 401: Invalid email or password
- 429: Too many login attempts (rate limited)

---

### 3. Send OTP (Mobile Login - Step 1)

**Endpoint**: `POST /api/auth/send-otp`

**cURL**:
```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+94771234567"
  }'
```

**Expected Response**:
```json
{
  "message": "OTP sent successfully to your registered email",
  "email": "jo***e@example.com"
}
```

**Error Cases**:
- 400: User with phone number not found
- 429: OTP recently sent, please wait

---

### 4. Verify OTP (Mobile Login - Step 2)

**Endpoint**: `POST /api/auth/verify-otp`

**cURL**:
```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+94771234567",
    "otp": "123456"
  }'
```

**Expected Response**:
```json
{
  "message": "Login successful",
  "user": {
    "id": "uuid-here",
    "email": "john.doe@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "patient"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Cases**:
- 401: Invalid OTP
- 401: OTP expired
- 401: Too many failed attempts

---

### 7. Refresh Access Token

**Endpoint**: `POST /api/auth/refresh`

**cURL** (camelCase):
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token-here"
  }'
```

**cURL** (snake_case):
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "your-refresh-token-here"
  }'
```

**cURL** (cookie-based):
```bash
# Assuming the refresh_token cookie is already set by the client (HttpOnly cookie), call the refresh endpoint without a body:
curl -X POST http://localhost:3000/api/auth/refresh -b "refresh_token=your-refresh-token-here"
```

**Expected Response**:
```json
{
  "message": "Token refreshed",
  "accessToken": "new-access-token"
}
```

Note: The refresh endpoint now requires a CSRF header when called using cookies. Include the value of the `csrf_token` cookie in the `X-CSRF-Token` header.

Example using curl when cookie already set:
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "X-CSRF-Token: <value-of-csrf_cookie>" \
  -b "refresh_token=your-refresh-token-here; csrf_token=<value-of-csrf_cookie>"
```

> Note: The new refresh token is set as an HttpOnly cookie (refresh_token) and is not returned in the JSON response.


### 8. Logout (Revoke Refresh Token)

**Endpoint**: `POST /api/auth/logout`

**cURL**:
```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token-here"
  }'
```

**Expected Response**:
```json
{ "message": "Logged out" }
```

---

### 5. Google OAuth Login

**Browser Flow**:
1. Navigate to: `http://localhost:3000/api/auth/google`
2. Login with Google account
3. Get redirected to frontend with token

---

### 6. Azure AD OAuth Login

**Browser Flow**:
1. Navigate to: `http://localhost:3000/api/auth/azure`
2. Login with Microsoft account
3. Get redirected to frontend with token

---

## 👥 User Management Endpoints

### Save the JWT Token

After successful login/registration, save the token:
```bash
export JWT_TOKEN="your-jwt-token-here"
```

---

### 1. Get Current User Profile

**Endpoint**: `GET /api/users/me`

**cURL**:
```bash
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response**:
```json
{
  "id": "uuid-here",
  "email": "john.doe@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+94771234567",
  "role": "patient",
  "age": 30,
  "gender": "male",
  "created_at": "2025-10-15T10:30:00.000Z"
}
```

---

### 2. List All Users (Admin/SuperAdmin Only)

**Endpoint**: `GET /api/users`

**cURL**:
```bash
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response**:
```json
[
  {
    "id": "uuid-1",
    "email": "doctor@example.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "role": "doctor",
    "created_at": "2025-10-15T10:30:00.000Z"
  },
  {
    "id": "uuid-2",
    "email": "patient@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "patient",
    "created_at": "2025-10-15T11:30:00.000Z"
  }
]
```

**Access Control**:
- SuperAdmin sees: admin, hospital, doctor, nurse, patient
- Admin sees: hospital, doctor, nurse, patient
- Other roles: 403 Forbidden

---

### 3. Get Users by Role (Admin/SuperAdmin Only)

**Endpoint**: `GET /api/users/role/:role`

**cURL**:
```bash
# Get all doctors
curl -X GET http://localhost:3000/api/users/role/doctor \
  -H "Authorization: Bearer $JWT_TOKEN"

# Get all patients
curl -X GET http://localhost:3000/api/users/role/patient \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response**: Array of users with specified role

---

### 4. Get User Statistics (Admin/SuperAdmin Only)

**Endpoint**: `GET /api/users/statistics`

**cURL**:
```bash
curl -X GET http://localhost:3000/api/users/statistics \
  -H "Authorization: Bearer $JWT_TOKEN"
```

**Expected Response**:
```json
{
  "total": 150,
  "byRole": {
    "patient": 100,
    "nurse": 20,
    "doctor": 15,
    "hospital": 10,
    "admin": 4,
    "super_admin": 1
  }
}
```

---

## 📋 Testing Scenarios

### Scenario 1: Complete Web User Journey

```bash
# 1. Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Alice","last_name":"Johnson","email":"alice@example.com","password":"Secure@123","confirm_password":"Secure@123","phone_number":"+94772222222","role":"doctor"}'

# 2. Login
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Secure@123"}' \
  | jq -r '.token')

# 3. Get Profile
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

---

### Scenario 2: Complete Mobile User Journey

```bash
# 1. Register (same as web)
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Bob","last_name":"Williams","email":"bob@example.com","password":"Mobile@123","confirm_password":"Mobile@123","phone_number":"+94773333333","role":"patient"}'

# 2. Request OTP
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+94773333333"}'

# 3. Check email for OTP (e.g., 654321)

# 4. Verify OTP and Login
TOKEN=$(curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+94773333333","otp":"654321"}' \
  | jq -r '.token')

# 5. Get Profile
curl -X GET http://localhost:3000/api/users/me \
  -H "Authorization: Bearer $TOKEN"
```

---

### Scenario 3: Admin Listing Users

```bash
# 1. Login as admin (you must create admin manually in Supabase)
ADMIN_TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123"}' \
  | jq -r '.token')

# 2. List all users
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Get statistics
curl -X GET http://localhost:3000/api/users/statistics \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 4. Get doctors only
curl -X GET http://localhost:3000/api/users/role/doctor \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

---

## 🧪 REST Client (.http file)

Create `api-test.http` in VS Code with REST Client extension:

```http
### Variables
@baseUrl = http://localhost:3000/api
@token = your-jwt-token-here

### Register User
POST {{baseUrl}}/auth/register
Content-Type: application/json

{
  "first_name": "Test",
  "last_name": "User",
  "email": "test@example.com",
  "password": "Test@123",
  "confirm_password": "Test@123",
  "phone_number": "+94771111111",
  "role": "patient",
  "age": 25,
  "gender": "male"
}

### Login
POST {{baseUrl}}/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Test@123"
}

### Send OTP
POST {{baseUrl}}/auth/send-otp
Content-Type: application/json

{
  "phone_number": "+94771111111"
}

### Verify OTP
POST {{baseUrl}}/auth/verify-otp
Content-Type: application/json

{
  "phone_number": "+94771111111",
  "otp": "123456"
}

### Get Current User Profile
GET {{baseUrl}}/users/me
Authorization: Bearer {{token}}

### List All Users (Admin)
GET {{baseUrl}}/users
Authorization: Bearer {{token}}

### Get Users by Role
GET {{baseUrl}}/users/role/doctor
Authorization: Bearer {{token}}

### Get Statistics
GET {{baseUrl}}/users/statistics
Authorization: Bearer {{token}}
```

---

## 🎯 Validation Testing

### Test Invalid Email Format
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid-email","password":"Test@123","confirm_password":"Test@123","first_name":"Test","last_name":"User","phone_number":"+94771111111","role":"patient"}'
```

**Expected**: 400 Bad Request with validation errors

---

### Test Weak Password
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"weak","confirm_password":"weak","first_name":"Test","last_name":"User","phone_number":"+94771111111","role":"patient"}'
```

**Expected**: 400 Bad Request - Password must meet complexity requirements

---

### Test Role Restriction
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"Admin@123","confirm_password":"Admin@123","first_name":"Admin","last_name":"User","phone_number":"+94771111111","role":"admin"}'
```

**Expected**: 400 Bad Request - Cannot register with admin role

---

### Test Unauthorized Access
```bash
curl -X GET http://localhost:3000/api/users/me
```

**Expected**: 401 Unauthorized

---

### Test Forbidden Access (Patient trying to list users)
```bash
# Login as patient and try to access admin endpoint
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer $PATIENT_TOKEN"
```

**Expected**: 403 Forbidden

---

## 📊 Performance Testing

### Rate Limiting Test
```bash
# Try to login 6 times in quick succession (limit is 5/minute)
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
  echo "\nAttempt $i"
done
```

**Expected**: 6th request should return 429 Too Many Requests

---

## 🔍 Debugging Tips

### Decode JWT Token
```bash
# Using jwt.io or command line
echo "your-jwt-token" | cut -d '.' -f 2 | base64 -d | jq
```

### Check Token Expiry
```bash
# Extract expiry timestamp
TOKEN_PAYLOAD=$(echo "$TOKEN" | cut -d '.' -f 2 | base64 -d)
EXPIRY=$(echo "$TOKEN_PAYLOAD" | jq -r '.exp')
CURRENT=$(date +%s)

if [ $EXPIRY -lt $CURRENT ]; then
  echo "Token expired"
else
  echo "Token valid for $((EXPIRY - CURRENT)) seconds"
fi
```

---

## ✅ Test Checklist

- [ ] User registration with valid data
- [ ] User registration with invalid data
- [ ] User registration with existing email
- [ ] Login with correct credentials
- [ ] Login with incorrect credentials
- [ ] OTP send to valid phone number
- [ ] OTP send to invalid phone number
- [ ] OTP verification with correct code
- [ ] OTP verification with incorrect code
- [ ] OTP verification after expiry
- [ ] Get current user profile with valid token
- [ ] Get current user profile with invalid token
- [ ] List users as admin
- [ ] List users as patient (should fail)
- [ ] Get users by role as admin
- [ ] Get statistics as admin
- [ ] Rate limiting on login endpoint
- [ ] Rate limiting on OTP endpoints
- [ ] Google OAuth flow
- [ ] Azure AD OAuth flow

---

## 🐛 Common Issues & Solutions

### Issue: "Unauthorized" even with valid token
**Solution**: Check if JWT_SECRET matches between registration and validation

### Issue: "User not found" when sending OTP
**Solution**: Verify phone number format (+CountryCode + Number)

### Issue: OTP not received
**Solution**: 
1. Check EMAIL_USER and EMAIL_PASS in .env
2. Verify Gmail App Password is correct
3. Check spam folder

### Issue: "Forbidden" when accessing admin endpoints
**Solution**: Ensure user role is 'admin' or 'super_admin'

---

## 📚 Additional Resources

- **Swagger UI**: `http://localhost:3000/api/docs`
- **Postman Collection**: Import from repository
- **VS Code REST Client**: Use `.http` examples above
- **API Documentation**: See README.md

---

Happy Testing! 🚀
