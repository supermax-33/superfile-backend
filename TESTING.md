# Testing the Authentication APIs

The authentication service exposes versioned REST endpoints under `/v1/auth`. The steps below outline how to exercise the
email/password + OTP flow as well as Google OAuth for both web and mobile style clients.

## Prerequisites

1. Install dependencies (requires access to the npm registry):
   ```bash
   pnpm install
   ```
2. Apply Prisma migrations and generate the client:
   ```bash
   pnpm prisma migrate deploy
   pnpm prisma generate
   ```
3. Supply the required environment variables in a `.env` file:
   ```env
   DATABASE_URL="postgres://..."
   JWT_SECRET="super-secret-key"
   JWT_ACCESS_TOKEN_TTL="15m"
   JWT_REFRESH_TOKEN_TTL="30d"
   AUTH_EMAIL_OTP_TTL="10m"
   AUTH_EMAIL_OTP_LENGTH="6"
   RESEND_API_KEY="..."               # For outbound email delivery
   GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="..."
   GOOGLE_CALLBACK_URL="http://localhost:3000/auth/google/callback"
   ```
4. Start the NestJS server:
   ```bash
   pnpm start:dev
   ```

## Email/Password + OTP Flow

1. **Signup (issue OTP)**
   ```bash
   curl -X POST http://localhost:3000/v1/auth/signup \
     -H 'Content-Type: application/json' \
     -d '{"email":"new.user@example.com","password":"Sup3rSafe!"}'
   ```
2. **Verify OTP** — replace `123456` with the code emailed to the user.
   ```bash
   curl -X POST http://localhost:3000/v1/auth/verify-email \
     -H 'Content-Type: application/json' \
     -d '{"code":"123456"}'
   ```
3. **Login**
   ```bash
   curl -X POST http://localhost:3000/v1/auth/login \
     -H 'Content-Type: application/json' \
     -d '{"email":"new.user@example.com","password":"Sup3rSafe!"}'
   ```
   The response contains `{ "accessToken": "...", "refreshToken": "..." }`.
4. **Refresh Access Token** — replace `<REFRESH_TOKEN>` with the token returned from login.
   ```bash
   curl -X POST http://localhost:3000/v1/auth/refresh-token \
     -H 'Content-Type: application/json' \
     -d '{"refreshToken":"<REFRESH_TOKEN>"}'
   ```
5. **Change Password (requires Authorization header)** — replace `<ACCESS_TOKEN>` accordingly.
   ```bash
   curl -X POST http://localhost:3000/v1/auth/change-password \
     -H 'Authorization: Bearer <ACCESS_TOKEN>' \
     -H 'Content-Type: application/json' \
     -d '{"currentPassword":"Sup3rSafe!","newPassword":"EvenS@fer1"}'
   ```

## Password Reset Flow

1. **Request Reset**
   ```bash
   curl -X POST http://localhost:3000/v1/auth/forgot-password \
     -H 'Content-Type: application/json' \
     -d '{"email":"new.user@example.com"}'
   ```
2. **Verify Reset Code** — replace `654321` with the code delivered by email.
   ```bash
   curl -X POST http://localhost:3000/v1/auth/verify-reset-code \
     -H 'Content-Type: application/json' \
     -d '{"code":"654321"}'
   ```
   The response contains a short-lived access token for resetting the password.
3. **Reset Password** — replace `<RESET_ACCESS_TOKEN>` with the token from the previous step.
   ```bash
   curl -X POST http://localhost:3000/v1/auth/reset-password \
     -H 'Content-Type: application/json' \
     -d '{"token":"<RESET_ACCESS_TOKEN>","newPassword":"N3wP@ssword!"}'
   ```

## Google OAuth Flow

### Web (server-initiated OAuth)
1. Navigate to `http://localhost:3000/v1/auth/google` in a browser. The guard redirects to Google for consent.
2. After approving access, Google redirects to `/v1/auth/google/callback`. The JSON payload contains the access and refresh tokens issued by this API.

### Mobile (ID token exchange)
1. Obtain a Google ID token on the device using the configured `GOOGLE_CLIENT_ID`.
2. Exchange the ID token for first-party JWTs:
   ```bash
   curl -X POST http://localhost:3000/v1/auth/google/token \
     -H 'Content-Type: application/json' \
     -d '{"idToken":"<GOOGLE_ID_TOKEN>"}'
   ```

## Protected Route Example

To validate the guards, hit a protected endpoint with the bearer token from either auth flow:
```bash
curl -X POST http://localhost:3000/v1/auth/change-password \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"currentPassword":"...","newPassword":"..."}'
```
If the token is missing, expired, or invalid, the response will be `401 Unauthorized` with a descriptive error message provided by `JwtExceptionFilter`.
