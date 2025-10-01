# API Endpoints

All routes are prefixed with `/api` and versioned under the `/v1` prefix via Nest's URI versioning. Unless otherwise noted, authenticated routes require a Bearer access token issued by the auth module.

## Auth

### `POST /api/v1/auth/signup`
Registers a new local (email/password) account and sends an email OTP for verification.

**Request**
```json
{
  "email": "alex@example.com",
  "password": "StrongPassw0rd"
}
```

**Response**
```json
{
  "message": "Signup successful, verification code sent."
}
```

**Error states**
- `409 Conflict` when the email already exists or is registered via a social provider.
- `500 Internal Server Error` if the verification email cannot be dispatched.

### `POST /api/v1/auth/resend-otp`
Re-sends the verification OTP to an unverified local account.

**Request**
```json
{
  "email": "alex@example.com"
}
```

**Response**
```json
{
  "message": "Verification code sent successfully"
}
```

**Error states**
- `404 Not Found` if no user exists for the supplied email.
- `500 Internal Server Error` if email delivery fails (same as signup).

### `POST /api/v1/auth/verify-email`
Confirms an OTP and marks the user as verified.

**Request**
```json
{
  "code": "123456"
}
```

**Response**
```json
{
  "message": "Email verified successfully"
}
```

**Error states**
- `400 Bad Request` when the code is invalid or expired.

### `POST /api/v1/auth/login`
Authenticates an email/password user and issues access/refresh tokens. Session metadata (IP + User-Agent) is recorded automatically from the request headers.

**Request**
```json
{
  "email": "alex@example.com",
  "password": "StrongPassw0rd"
}
```

**Response**
```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Error states**
- `401 Unauthorized` for invalid credentials.
- `403 Forbidden` if the account has not verified its email yet.

### `POST /api/v1/auth/refresh-token`
Rotates refresh tokens and returns a new access/refresh pair while persisting the session metadata.

**Request**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response**
```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

**Error states**
- `401 Unauthorized` if the token is invalid, expired, re-used, missing a session id, or does not match an active session.
- `403 Forbidden` when the session has been revoked.

### `POST /api/v1/auth/change-password`
Updates the password for a local account and revokes all sessions. Requires an access token in the `Authorization` header. Revokes all sessions, including the current one after a successful change.

**Request**
```json
{
  "currentPassword": "OldPass123!",
  "newPassword": "NewPass123!"
}
```

**Response**
```json
{
  "message": "Password updated successfully. Please log in again."
}
```

**Error states**
- `400 Bad Request` if the account is not password-based or the new password matches the current one.
- `401 Unauthorized` when the current password is wrong or the user context cannot be resolved.

```json
{
  "message": "Password updated successfully. Please log in again."
}
```

**Error states**
- `400 Bad Request` if the account is not password-based or the new password matches the current one.
- `401 Unauthorized` when the current password is wrong or the user context cannot be resolved.

### `POST /api/v1/auth/forgot-password`
Initiates the password reset flow and (silently) emails a reset code for local accounts.

**Request**
```json
{
  "email": "alex@example.com"
}
```

**Response**
```json
{
  "message": "You will receive a password reset code if your email is registered."
}
```

**Error states**
- Always returns `200 OK` even if the email is unknown or social-login based (no leakage).

### `POST /api/v1/auth/verify-reset-code`
Validates a reset code and returns a short-lived access token when valid.

**Request**
```json
{
  "code": "789012"
}
```

**Response**
```json
{
  "valid": true,
  "message": "User authenticated. Please reset your password.",
  "accessToken": "temporary-access-token"
}
```

**Error states**
- Returns `200 OK` with `{ "valid": false, "message": "Invalid or expired code" }` when verification fails.

### `POST /api/v1/auth/reset-password`
Consumes the temporary access token to set a new password and revoke all sessions.

**Request**
```json
{
  "token": "temporary-access-token",
  "newPassword": "BrandNewPassw0rd"
}
```

**Response**
```json
{
  "message": "Password reset successful. Please log in again."
}
```

**Error states**
- `401 Unauthorized` when the token is invalid or expired.
- `400 Bad Request` if the authenticated account is not email/password based.

### `GET /api/v1/auth/google`
Redirects the browser to Google's OAuth consent screen. The Nest guard handles the 302 redirect; no JSON body is returned.

### `GET /api/v1/auth/google/callback`
Handles the OAuth callback and returns auth tokens after exchanging the Google profile.

**Response**
```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Error states**
- `401 Unauthorized` if Google does not supply an email or the token cannot be validated.
- `500 Internal Server Error` for unexpected failures.
- `409 Conflict` when the email belongs to a non-Google account.

### `POST /api/v1/auth/google/token`
Exchanges a Google ID token (used by native/mobile clients) for first-party JWTs.

**Request**
```json
{
  "idToken": "google-id-token"
}
```

**Response**
```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Error states**
- `400 Bad Request` if Google OAuth is not configured on the server.
- `401 Unauthorized` when the ID token is invalid or has an unexpected payload.

## Spaces

All space routes require an authenticated owner context via `JwtAuthGuard`. The owner-only guard enforces that the caller owns the targeted space.

### `POST /api/v1/spaces`
Creates a new space and provisions an OpenAI vector store for file search.

**Request**
```json
{
  "name": "Project Atlas",
  "slug": "project-atlas"
}
```

**Response**
```json
{
  "id": "d1c5e7f0-28cc-49ec-9f42-5b25a38c56c7",
  "slug": "project-atlas",
  "name": "Project Atlas",
  "ownerId": "user-id",
  "vectorStoreId": "vs_123",
  "createdAt": "2024-05-01T12:34:56.000Z",
  "updatedAt": "2024-05-01T12:34:56.000Z",
  "logo": null
}
```

**Error states**
- `500 Internal Server Error` if the vector store cannot be created or cleaned up.

### `PATCH /api/v1/spaces/:id`
Updates the space name and/or slug.

**Request**
```json
{
  "name": "Atlas Research",
  "slug": "atlas-research"
}
```

**Response**
```json
{
  "id": "d1c5e7f0-28cc-49ec-9f42-5b25a38c56c7",
  "slug": "atlas-research",
  "name": "Atlas Research",
  "ownerId": "user-id",
  "vectorStoreId": "vs_123",
  "createdAt": "2024-05-01T12:34:56.000Z",
  "updatedAt": "2024-05-02T08:15:30.000Z",
  "logo": null
}
```

**Error states**
- `400 Bad Request` if no fields are provided or the normalized name is empty.

### `DELETE /api/v1/spaces/:id`
Deletes the space, its vector store, and associated records. Returns `204 No Content` on success.

**Error states**
- `404 Not Found` if the space does not exist.
- `500 Internal Server Error` if the vector store or storage cleanup fails.

### `GET /api/v1/spaces/:id`
Fetches a single space including logo metadata.

### `PUT /api/v1/spaces/:id/logo`
Uploads or replaces the space logo via `multipart/form-data` (`file` field) and returns the updated space.

**Error states**
- `400 Bad Request` when no file is attached.
- `404 Not Found` if the space cannot be loaded after upload.

## Files

All routes are JWT-protected. Uploads accept MIME types defined by `ALLOWED_MIME_TYPES` (pdf for now) and are size-limited by `MAX_FILE_SIZE_BYTES` (25MB for now). Ownership checks ensure files and spaces belong to the caller.

### `POST /api/v1/files`
Uploads one or more files to a space and triggers ingestion into the vector store. Uses `multipart/form-data` with the `files` field plus JSON body fields `spaceId` and optional `note`

**Request (multipart fields)**
- `files[]`: binary attachments
- `spaceId`: UUID of the target space
- `note` *(optional)*: string note stored with each file【F:src/file/dto/upload-files.dto.ts†L4-L10】

**Response**
```json
[
  {
    "id": "2b1a2d6b-3cf6-4c3e-98fc-5a7a5a2c4e11",
    "spaceId": "d1c5e7f0-28cc-49ec-9f42-5b25a38c56c7",
    "filename": "design-doc.pdf",
    "mimetype": "application/pdf",
    "size": 523445,
    "status": "PROCESSING",
    "s3Key": "spaces/d1c5e7f0/design-doc.pdf",
    "vectorStoreId": "vs_123",
    "openAiFileId": null,
    "error": null,
    "note": "Initial draft",
    "uploadedAt": "2024-05-02T10:00:00.000Z",
    "updatedAt": "2024-05-02T10:00:00.000Z"
  }
]
```

**Error states**
- `400 Bad Request` if no files are attached, a file type is disallowed, a file exceeds the size limit, or the space lacks a vector store.
- `403 Forbidden` if the caller does not own the target space.
- `404 Not Found` if the space does not exist.

### `GET /api/v1/files`
Lists files owned by the authenticated user

**Example Response**
```json
[
  {
    "id": "2b1a2d6b-3cf6-4c3e-98fc-5a7a5a2c4e11",
    "spaceId": "d1c5e7f0-28cc-49ec-9f42-5b25a38c56c7",
    "filename": "design-doc.pdf",
    "mimetype": "application/pdf",
    "size": 523445,
    "status": "SUCCESS",
    "s3Key": "spaces/d1c5e7f0/design-doc.pdf",
    "vectorStoreId": "vs_123",
    "openAiFileId": "file-abc",
    "error": null,
    "note": "Initial draft",
    "uploadedAt": "2024-05-02T10:00:00.000Z",
    "updatedAt": "2024-05-02T10:05:12.000Z"
  }
]
```

### `GET /api/v1/files/:id`
Downloads a file stream after verifying ownership. Response headers include `Content-Type`, `Content-Disposition`, and optionally `Content-Length`.

**Error states**
- `404 Not Found` if the file does not exist or is not owned by the user.

### `GET /api/v1/files/:id/note`
Fetches the stored note for a file.

### `PATCH /api/v1/files/:id/note`
Updates the note content.

**Request**
```json
{
  "note": "Updated note"
}
```

**Response**
```json
{
  "note": "Updated note"
}
```

**Error states**
- `404 Not Found` if the file is missing or not owned by the caller.

### `DELETE /api/v1/files/:id/note`
Clears the note. Returns `204 No Content`.

### `GET /api/v1/files/:id/progress`
Retrieves real-time upload progress or a completed snapshot if the upload has finished.

### `PATCH /api/v1/files/:id/status`
Refreshes the ingestion status from OpenAI and updates the local record.

**Error states**
- `404 Not Found` if the file is missing.
- `400 Bad Request` when the file has not been ingested yet (no OpenAI ids).

### `DELETE /api/v1/files`
Batch deletes files by id and reports per-file success/failure details.

**Request**
```json
{
  "fileIds": [
    "2b1a2d6b-3cf6-4c3e-98fc-5a7a5a2c4e11",
    "19a1b2c3-4d5e-678f-9012-3456789abcde"
  ]
}
```

**Response**
```json
{
  "deleted": ["2b1a2d6b-3cf6-4c3e-98fc-5a7a5a2c4e11"],
  "failed": [
    {
      "fileId": "19a1b2c3-4d5e-678f-9012-3456789abcde",
      "error": "File not found or access denied."
    }
  ]
}
```

**Error states**
- `400 Bad Request` if no `fileIds` are supplied.

### `POST /api/v1/files/download`
Generates short-lived download URLs for multiple files.

**Request**
```json
{
  "fileIds": [
    "2b1a2d6b-3cf6-4c3e-98fc-5a7a5a2c4e11"
  ]
}
```

**Response**
```json
{
  "files": [
    {
      "fileId": "2b1a2d6b-3cf6-4c3e-98fc-5a7a5a2c4e11",
      "filename": "design-doc.pdf",
      "mimetype": "application/pdf",
      "size": 523445,
      "downloadUrl": "https://s3.example.com/presigned"
    }
  ]
}
```

**Error states**
- `400 Bad Request` if no ids are provided.
- `404 Not Found` when any requested file is missing or not owned by the user.
- `500 Internal Server Error` if a presigned URL cannot be generated.

### `DELETE /api/v1/files/:id`
Deletes a single file, removing S3 and OpenAI artifacts. Returns `204 No Content`.

**Error states**
- `404 Not Found` if the file does not exist or is not owned by the caller.
- `500 Internal Server Error` if storage or vector store cleanup fails.

## Conversations

All conversation endpoints are JWT-protected and scoped to the owning space. Ownership checks ensure conversations belong to the caller's space.

### `POST /api/v1/spaces/:spaceId/conversations`
Creates a new conversation within a space. Title is optional; if omitted the system will auto-name later.

**Request**
```json
{
  "title": "Research recap"
}
```

**Response**
```json
{
  "id": "0fbb3fbf-1cf3-4b50-9e66-298eb2b01d83",
  "spaceId": "d1c5e7f0-28cc-49ec-9f42-5b25a38c56c7",
  "title": "Research recap",
  "manuallyRenamed": true,
  "autoTitleGeneratedAt": null,
  "createdAt": "2024-05-02T11:00:00.000Z",
  "updatedAt": "2024-05-02T11:00:00.000Z"
}
```

**Error states**
- `404 Not Found` if the space does not exist for the user.
- `403 Forbidden` when the space is owned by someone else.

### `GET /api/v1/spaces/:spaceId/conversations`
Lists conversations in a space (newest first).

### `GET /api/v1/conversations/:id/messages`
Returns the ordered message history with hydrated file references and assistant actions.

**Error states**
- `404 Not Found` or `403 Forbidden` if the conversation is missing or belongs to another user.

### `POST /api/v1/conversations/:id/messages`
Sends a user message and streams the assistant reply over Server-Sent Events (SSE). Events include:
- `event: token` with incremental text chunks
- `event: final` with `{ "message": ConversationMessageResponseDto, "references": ... }`

**Request**
```json
{
  "content": "Summarize the latest design document."
}
```

**Error states**
- `404 Not Found` if the conversation or space is missing.
- `403 Forbidden` when the user lacks access.
- `500 Internal Server Error` for OpenAI failures or missing vector store configuration.

### `DELETE /api/v1/conversations/:id`
Deletes a conversation after verifying ownership. Returns `204 No Content`.

## Reminders

Reminder routes are nested under a space and require JWT authentication. Ownership checks ensure reminders and files belong to the caller’s space.

### `POST /api/v1/spaces/:spaceId/reminders`
Creates a reminder with optional note and linked files.

**Request**
```json
{
  "title": "Review design doc",
  "note": "Check chapter 3",
  "remindAt": "2024-05-10T09:00:00.000Z",
  "fileIds": ["2b1a2d6b-3cf6-4c3e-98fc-5a7a5a2c4e11"]
}
```

**Response**
```json
{
  "id": "63e29fa0-7f94-4c9a-8a24-8ac2e9f5be97",
  "spaceId": "d1c5e7f0-28cc-49ec-9f42-5b25a38c56c7",
  "ownerId": "user-id",
  "title": "Review design doc",
  "note": "Check chapter 3",
  "remindAt": "2024-05-10T09:00:00.000Z",
  "createdAt": "2024-05-02T12:00:00.000Z",
  "updatedAt": "2024-05-02T12:00:00.000Z",
  "files": [
    {
      "id": "2b1a2d6b-3cf6-4c3e-98fc-5a7a5a2c4e11",
      "spaceId": "d1c5e7f0-28cc-49ec-9f42-5b25a38c56c7",
      "userId": "user-id",
      "filename": "design-doc.pdf",
      "mimetype": "application/pdf",
      "size": 523445,
      "status": "SUCCESS",
      "uploadedAt": "2024-05-02T10:00:00.000Z",
      "updatedAt": "2024-05-02T10:05:12.000Z"
    }
  ]
}
```

**Error states**
- `404 Not Found` when the space does not belong to the user or linked files are missing from the space.

### `GET /api/v1/spaces/:spaceId/reminders`
Lists reminders ordered by `remindAt`.

### `GET /api/v1/spaces/:spaceId/reminders/:id`
Returns a single reminder with file details.

### `PATCH /api/v1/spaces/:spaceId/reminders/:id`
Updates reminder attributes and linked file set.

**Error states**
- `404 Not Found` if the reminder is missing, belongs to another user, or new fileIds are invalid.

### `DELETE /api/v1/spaces/:spaceId/reminders/:id`
Deletes a reminder. Returns `204 No Content`.

### `POST /api/v1/spaces/:spaceId/reminders/:id/files`
Adds additional files to an existing reminder (duplicates are ignored).

**Request**
```json
{
  "fileIds": ["3c4d5e6f-7a8b-4c1d-9e2f-345678901234"]
}
```

**Response**
Returns the updated reminder payload (same shape as creation).

**Error states**
- `404 Not Found` if the reminder or files are not found in the space.

### `DELETE /api/v1/spaces/:spaceId/reminders/:id/files/:fileId`
Removes a linked file from a reminder and returns the updated reminder.

**Error states**
- `404 Not Found` if the reminder, file, or association does not exist.

## Sessions

Session routes allow users to manage their active refresh sessions; all require a valid access token.

### `GET /api/v1/sessions`
Lists active sessions (non-revoked, non-expired). Useful for account devices UI.

**Response**
```json
[
  {
    "id": "session-id",
    "ipAddress": "203.0.113.24",
    "userAgent": "Mozilla/5.0",
    "createdAt": "2024-04-29T09:12:33.000Z",
    "lastUsedAt": "2024-05-02T13:22:10.000Z",
    "expiresAt": "2024-05-16T09:12:33.000Z"
  }
]
```

### `DELETE /api/v1/sessions/:sessionId`
Revokes a specific refresh session (e.g., logout from one device). Returns `{ "message": "Session invalidated." }`.

### `DELETE /api/v1/sessions`
Revokes every active session for the user. Returns `{ "message": "All sessions invalidated." }`.

**Error states (for both deletes)**
- `401 Unauthorized` if the session id is unknown, revoked, or expired; the service treats these as unauthorized session manipulations.
