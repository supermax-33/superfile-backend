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

---

# Testing the Files API

The Files service exposes versioned endpoints under `/v1/files` and requires the same JWT bearer token used by the authentication flows above. Before exercising the endpoints:

1. Ensure the following environment variables are populated so the server can reach Amazon S3 and OpenAI:
   ```env
   AWS_ACCESS_KEY_ID="..."
   AWS_SECRET_ACCESS_KEY="..."
   AWS_REGION="us-east-1"
   AWS_S3_BUCKET="your-bucket-name"
   OPENAI_API_KEY="sk-..."
   ```
2. Confirm the target space exists (see the space creation endpoints) and capture its `id`.
3. Start the NestJS server if it is not already running:
   ```bash
   pnpm start:dev
   ```

## Upload PDFs (multipart)

Use Postman or the CLI to send a multipart request with one or more PDF files. All files must belong to the same space.

### Postman

1. Create a new `POST` request to `http://localhost:3000/v1/files`.
2. Add an `Authorization` header with `Bearer <ACCESS_TOKEN>`.
3. Select **Body → form-data** and add the following fields:
   - Key `spaceId` (type `Text`) with the UUID of the space that should own the files.
   - Key `files` (type `File`). Add one or more rows, attaching a PDF to each.
4. Send the request. The response contains an array of file metadata objects including `status`, `s3Key`, and `openAiFileId`.

### curl

```bash
curl -X POST http://localhost:3000/v1/files \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -F 'spaceId=<SPACE_ID>' \
  -F 'files=@/path/to/document.pdf;type=application/pdf'
```

## Check Upload Progress

While an upload is in flight, poll the progress endpoint (returns 100 once the upload completes and the in-memory entry is cleared):

```bash
curl -X GET http://localhost:3000/v1/files/<FILE_ID>/progress \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Refresh OpenAI Ingestion Status

```bash
curl -X PATCH http://localhost:3000/v1/files/<FILE_ID>/status \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```
The response echoes the updated metadata. Expect `status` to become `SUCCESS` once OpenAI completes ingestion. Errors are captured in the `error` field.

## Download a File

```bash
curl -X GET http://localhost:3000/v1/files/<FILE_ID> \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -L -o downloaded.pdf
```

## Delete a File

```bash
curl -X DELETE http://localhost:3000/v1/files/<FILE_ID> \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

When the delete call succeeds the record is removed from Prisma, the object is purged from S3, and (if one exists) the associated OpenAI vector store file is deleted.

---

## End-to-end Test Modes

- Run `pnpm test:e2e` to exercise the happy-path workflow with in-memory fakes for S3 uploads, OpenAI vector stores, and streaming (fast, deterministic).
- Set `E2E_REAL_INTEGRATIONS=true pnpm test:e2e` to hit your configured AWS and OpenAI accounts. Ensure `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`, and `OPENAI_API_KEY` are present in `.env`.
- Add `E2E_PERSIST_DATA=true` alongside the real integrations flag when you want the suite to leave behind inspection data (spaces, files, reminders, conversations) and emit rich logs for manual verification.

---

# Testing the Reminders API

Reminders are scoped to a space and surfaced under `/v1/spaces/:spaceId/reminders`. All calls require the bearer token from the authentication flow as well as the UUID of a space the caller owns.

## Create a Reminder

```bash
curl -X POST http://localhost:3000/v1/spaces/<SPACE_ID>/reminders \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{
        "title": "Quarterly business review",
        "note": "Prep deck by Friday",
        "remindAt": "2024-09-30T15:00:00.000Z",
        "fileIds": ["<FILE_ID>"]
      }'
```

## List Reminders for a Space

```bash
curl -X GET http://localhost:3000/v1/spaces/<SPACE_ID>/reminders \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Update a Reminder

```bash
curl -X PATCH http://localhost:3000/v1/spaces/<SPACE_ID>/reminders/<REMINDER_ID> \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"note": "Deck finalized"}'
```

## Attach or Remove Files

```bash
curl -X POST http://localhost:3000/v1/spaces/<SPACE_ID>/reminders/<REMINDER_ID>/files \
  -H 'Authorization: Bearer <ACCESS_TOKEN>' \
  -H 'Content-Type: application/json' \
  -d '{"fileIds": ["<FILE_ID>"]}'

curl -X DELETE http://localhost:3000/v1/spaces/<SPACE_ID>/reminders/<REMINDER_ID>/files/<FILE_ID> \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Delete a Reminder

```bash
curl -X DELETE http://localhost:3000/v1/spaces/<SPACE_ID>/reminders/<REMINDER_ID> \
  -H 'Authorization: Bearer <ACCESS_TOKEN>'
```
