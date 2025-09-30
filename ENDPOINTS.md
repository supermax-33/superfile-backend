# API Endpoints

_All routes are versioned under the `/v1` prefix via Nest's URI versioning. Unless otherwise noted, authenticated routes require a Bearer access token issued by the auth module._

## Auth

### `POST /v1/auth/signup`
Registers a new local (email/password) account and sends an email OTP for verification.【F:src/auth/auth.controller.ts†L42-L47】【F:src/auth/auth.service.ts†L138-L166】

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
- `409 Conflict` when the email already exists or is registered via a social provider.【F:src/auth/auth.service.ts†L143-L169】
- `500 Internal Server Error` if the verification email cannot be dispatched.【F:src/auth/auth.service.ts†L60-L83】

### `POST /v1/auth/resend-otp`
Re-sends the verification OTP to an unverified local account.【F:src/auth/auth.controller.ts†L49-L53】【F:src/auth/auth.service.ts†L174-L185】

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
- `404 Not Found` if no user exists for the supplied email.【F:src/auth/auth.service.ts†L174-L184】
- `500 Internal Server Error` if email delivery fails (same as signup).

### `POST /v1/auth/verify-email`
Confirms an OTP and marks the user as verified.【F:src/auth/auth.controller.ts†L55-L59】【F:src/auth/auth.service.ts†L187-L213】

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
- `400 Bad Request` when the code is invalid or expired.【F:src/auth/auth.service.ts†L187-L213】

### `POST /v1/auth/login`
Authenticates an email/password user and issues access/refresh tokens. Session metadata (IP + User-Agent) is recorded automatically from the request headers.【F:src/auth/auth.controller.ts†L61-L65】【F:src/auth/auth.service.ts†L215-L235】

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
- `401 Unauthorized` for invalid credentials.【F:src/auth/auth.service.ts†L220-L233】
- `403 Forbidden` if the account has not verified its email yet.【F:src/auth/auth.service.ts†L224-L228】

### `POST /v1/auth/refresh-token`
Rotates refresh tokens and returns a new access/refresh pair while persisting the session metadata.【F:src/auth/auth.controller.ts†L67-L71】【F:src/auth/auth.service.ts†L238-L270】

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
- `401 Unauthorized` if the token is invalid, expired, missing a session id, or does not match an active session.【F:src/auth/auth.service.ts†L238-L269】

### `POST /v1/auth/change-password`
Updates the password for a local account and revokes all sessions. Requires an access token in the `Authorization` header.【F:src/auth/auth.controller.ts†L73-L82】【F:src/auth/auth.service.ts†L272-L312】

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
- `400 Bad Request` if the account is not password-based or the new password matches the current one.【F:src/auth/auth.service.ts†L282-L299】
- `401 Unauthorized` when the current password is wrong or the user context cannot be resolved.【F:src/auth/auth.service.ts†L276-L294】

### `POST /v1/auth/forgot-password`
Initiates the password reset flow and (silently) emails a reset code for local accounts.【F:src/auth/auth.controller.ts†L84-L88】【F:src/auth/auth.service.ts†L314-L343】

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
- Always returns `200 OK` even if the email is unknown or social-login based (no leakage).【F:src/auth/auth.service.ts†L319-L343】

### `POST /v1/auth/verify-reset-code`
Validates a reset code and returns a short-lived access token when valid.【F:src/auth/auth.controller.ts†L90-L94】【F:src/auth/auth.service.ts†L345-L379】

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
- Returns `200 OK` with `{ "valid": false, "message": "Invalid or expired code" }` when verification fails.【F:src/auth/auth.service.ts†L357-L359】

### `POST /v1/auth/reset-password`
Consumes the temporary access token to set a new password and revoke all sessions.【F:src/auth/auth.controller.ts†L96-L100】【F:src/auth/auth.service.ts†L382-L405】

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
- `401 Unauthorized` when the token is invalid or expired.【F:src/auth/auth.service.ts†L383-L388】
- `400 Bad Request` if the authenticated account is not email/password based.【F:src/auth/auth.service.ts†L390-L394】

### `GET /v1/auth/google`
Redirects the browser to Google's OAuth consent screen. The Nest guard handles the 302 redirect; no JSON body is returned.【F:src/auth/auth.controller.ts†L102-L109】

### `GET /v1/auth/google/callback`
Handles the OAuth callback and returns auth tokens after exchanging the Google profile.【F:src/auth/auth.controller.ts†L111-L126】【F:src/auth/auth.service.ts†L408-L458】

**Response**
```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token"
}
```

**Error states**
- `401 Unauthorized` if Google does not supply an email or the token cannot be validated.【F:src/auth/auth.service.ts†L412-L415】【F:src/auth/auth.service.ts†L471-L484】
- `409 Conflict` when the email belongs to a non-Google account.【F:src/auth/auth.service.ts†L422-L425】

### `POST /v1/auth/google/token`
Exchanges a Google ID token (used by native/mobile clients) for first-party JWTs.【F:src/auth/auth.controller.ts†L128-L136】【F:src/auth/auth.service.ts†L460-L495】

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
- `400 Bad Request` if Google OAuth is not configured on the server.【F:src/auth/auth.service.ts†L464-L468】
- `401 Unauthorized` when the ID token is invalid or has an unexpected payload.【F:src/auth/auth.service.ts†L471-L484】

## Spaces

All space routes require an authenticated owner context via `JwtAuthGuard`. The owner-only guard enforces that the caller owns the targeted space.【F:src/space/space.controller.ts†L34-L74】

### `POST /v1/spaces`
Creates a new space and provisions an OpenAI vector store for file search.【F:src/space/space.controller.ts†L31-L47】【F:src/space/space.service.ts†L52-L85】

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
- `500 Internal Server Error` if the vector store cannot be created or cleaned up.【F:src/space/space.service.ts†L60-L84】

### `PATCH /v1/spaces/:id`
Updates the space name and/or slug.【F:src/space/space.controller.ts†L48-L64】【F:src/space/space.service.ts†L87-L118】

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
- `400 Bad Request` if no fields are provided or the normalized name is empty.【F:src/space/space.service.ts†L93-L109】

### `DELETE /v1/spaces/:id`
Deletes the space, its vector store, and associated records. Returns `204 No Content` on success.【F:src/space/space.controller.ts†L65-L73】【F:src/space/space.service.ts†L120-L144】

**Error states**
- `404 Not Found` if the space does not exist.【F:src/space/space.service.ts†L120-L128】
- `500 Internal Server Error` if the vector store or storage cleanup fails.【F:src/space/space.service.ts†L130-L140】

### `GET /v1/spaces/:id`
Fetches a single space including logo metadata.【F:src/space/space.controller.ts†L74-L80】【F:src/space/space.service.ts†L179-L190】

### `PUT /v1/spaces/:id/logo`
Uploads or replaces the space logo via `multipart/form-data` (`file` field) and returns the updated space.【F:src/space/space.controller.ts†L81-L107】【F:src/space/space.service.ts†L146-L177】

**Error states**
- `400 Bad Request` when no file is attached.【F:src/space/space.controller.ts†L96-L102】
- `404 Not Found` if the space cannot be loaded after upload.【F:src/space/space.service.ts†L167-L177】

## Files

All routes are JWT-protected. Uploads accept MIME types defined by `ALLOWED_MIME_TYPES` and are size-limited by `MAX_FILE_SIZE_BYTES`.【F:src/file/file.controller.ts†L40-L111】【F:src/file/file.service.ts†L41-L160】【F:src/file/file.service.ts†L568-L581】

### `POST /v1/files`
Uploads one or more files to a space and triggers ingestion into the vector store. Use `multipart/form-data` with the `files` field plus JSON body fields `spaceId` and optional `note` (Nest handles the mix automatically).【F:src/file/file.controller.ts†L43-L74】

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
- `400 Bad Request` if no files are attached, a file type is disallowed, a file exceeds the size limit, or the space lacks a vector store.【F:src/file/file.service.ts†L41-L115】【F:src/file/file.service.ts†L64-L69】【F:src/file/file.service.ts†L568-L581】
- `403 Forbidden` if the caller does not own the target space.【F:src/file/file.service.ts†L51-L62】
- `404 Not Found` if the space does not exist.【F:src/file/file.service.ts†L51-L58】

### `GET /v1/files`
Lists files owned by the authenticated user, optionally filtered by `spaceId` and/or `status` query params.【F:src/file/file.controller.ts†L75-L87】【F:src/file/file.service.ts†L163-L179】【F:src/file/dto/list-files-query.dto.ts†L3-L11】

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

### `GET /v1/files/:id`
Downloads a file stream after verifying ownership. Response headers include `Content-Type`, `Content-Disposition`, and optionally `Content-Length`.【F:src/file/file.controller.ts†L88-L118】【F:src/file/file.service.ts†L286-L314】

**Error states**
- `404 Not Found` if the file does not exist or is not owned by the user.【F:src/file/file.service.ts†L295-L304】

### `GET /v1/files/:id/note`
Fetches the stored note for a file.【F:src/file/file.controller.ts†L119-L128】【F:src/file/file.service.ts†L181-L195】

### `PATCH /v1/files/:id/note`
Updates the note content.【F:src/file/file.controller.ts†L129-L138】【F:src/file/file.service.ts†L197-L221】

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
- `404 Not Found` if the file is missing or not owned by the caller.【F:src/file/file.service.ts†L200-L212】

### `DELETE /v1/files/:id/note`
Clears the note. Returns `204 No Content`.【F:src/file/file.controller.ts†L139-L148】【F:src/file/file.service.ts†L223-L240】

### `GET /v1/files/:id/progress`
Retrieves real-time upload progress or a completed snapshot if the upload has finished.【F:src/file/file.controller.ts†L149-L158】【F:src/file/file.service.ts†L242-L284】

### `PATCH /v1/files/:id/status`
Refreshes the ingestion status from OpenAI and updates the local record.【F:src/file/file.controller.ts†L159-L168】【F:src/file/file.service.ts†L316-L349】

**Error states**
- `404 Not Found` if the file is missing.【F:src/file/file.service.ts†L320-L329】
- `400 Bad Request` when the file has not been ingested yet (no OpenAI ids).【F:src/file/file.service.ts†L331-L333】

### `DELETE /v1/files`
Batch deletes files by id and reports per-file success/failure details.【F:src/file/file.controller.ts†L169-L186】【F:src/file/file.service.ts†L351-L463】

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
- `400 Bad Request` if no `fileIds` are supplied.【F:src/file/file.service.ts†L384-L401】

### `POST /v1/files/download`
Generates short-lived download URLs for multiple files.【F:src/file/file.controller.ts†L187-L204】【F:src/file/file.service.ts†L465-L525】

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
- `400 Bad Request` if no ids are provided.【F:src/file/file.service.ts†L469-L480】
- `404 Not Found` when any requested file is missing or not owned by the user.【F:src/file/file.service.ts†L492-L496】
- `500 Internal Server Error` if a presigned URL cannot be generated.【F:src/file/file.service.ts†L507-L521】

### `DELETE /v1/files/:id`
Deletes a single file, removing S3 and OpenAI artifacts. Returns `204 No Content`.【F:src/file/file.controller.ts†L205-L214】【F:src/file/file.service.ts†L351-L383】

**Error states**
- `404 Not Found` if the file does not exist or is not owned by the caller.【F:src/file/file.service.ts†L352-L360】
- `500 Internal Server Error` if storage or vector store cleanup fails.【F:src/file/file.service.ts†L363-L378】

## Conversations

All conversation endpoints are JWT-protected and scoped to the owning space.【F:src/conversation/conversation.controller.ts†L25-L92】【F:src/conversation/conversation.service.ts†L58-L371】

### `POST /v1/spaces/:spaceId/conversations`
Creates a new conversation within a space. Title is optional; if omitted the system will auto-name later.【F:src/conversation/conversation.controller.ts†L39-L48】【F:src/conversation/conversation.service.ts†L58-L74】【F:src/conversation/dto/create-conversation.dto.ts†L1-L8】

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
- `404 Not Found` if the space does not exist for the user.【F:src/conversation/conversation.service.ts†L355-L366】
- `403 Forbidden` when the space is owned by someone else.【F:src/conversation/conversation.service.ts†L368-L369】

### `GET /v1/spaces/:spaceId/conversations`
Lists conversations in a space (newest first).【F:src/conversation/conversation.controller.ts†L50-L58】【F:src/conversation/conversation.service.ts†L76-L90】

### `GET /v1/conversations/:id/messages`
Returns the ordered message history with hydrated file references and assistant actions.【F:src/conversation/conversation.controller.ts†L60-L68】【F:src/conversation/conversation.service.ts†L92-L111】【F:src/conversation/dto/conversation-message-response.dto.ts†L1-L27】

**Error states**
- `404 Not Found` or `403 Forbidden` if the conversation is missing or belongs to another user.【F:src/conversation/conversation.service.ts†L333-L352】

### `POST /v1/conversations/:id/messages`
Sends a user message and streams the assistant reply over Server-Sent Events (SSE). Events include:
- `event: token` with incremental text chunks
- `event: final` with `{ "message": ConversationMessageResponseDto, "references": ... }`
【F:src/conversation/conversation.controller.ts†L70-L82】【F:src/conversation/conversation.service.ts†L113-L312】

**Request**
```json
{
  "content": "Summarize the latest design document."
}
```

**Error states**
- `404 Not Found` if the conversation or space is missing.【F:src/conversation/conversation.service.ts†L136-L171】【F:src/conversation/conversation.service.ts†L333-L352】
- `403 Forbidden` when the user lacks access.【F:src/conversation/conversation.service.ts†L333-L349】
- `500 Internal Server Error` for OpenAI failures or missing vector store configuration.【F:src/conversation/conversation.service.ts†L165-L197】【F:src/conversation/conversation.service.ts†L247-L253】

### `DELETE /v1/conversations/:id`
Deletes a conversation after verifying ownership. Returns `204 No Content`.【F:src/conversation/conversation.controller.ts†L83-L92】【F:src/conversation/conversation.service.ts†L274-L280】

## Reminders

Reminder routes are nested under a space and require JWT authentication. Ownership checks ensure reminders and files belong to the caller’s space.【F:src/reminder/reminder.controller.ts†L24-L92】【F:src/reminder/reminder.service.ts†L13-L215】

### `POST /v1/spaces/:spaceId/reminders`
Creates a reminder with optional note and linked files.【F:src/reminder/reminder.controller.ts†L28-L41】【F:src/reminder/reminder.service.ts†L13-L37】【F:src/reminder/dto/create-reminder.dto.ts†L1-L22】

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
- `404 Not Found` when the space does not belong to the user or linked files are missing from the space.【F:src/reminder/reminder.service.ts†L18-L37】【F:src/reminder/reminder.service.ts†L232-L251】

### `GET /v1/spaces/:spaceId/reminders`
Lists reminders ordered by `remindAt`.【F:src/reminder/reminder.controller.ts†L43-L52】【F:src/reminder/reminder.service.ts†L39-L52】

### `GET /v1/spaces/:spaceId/reminders/:id`
Returns a single reminder with file details.【F:src/reminder/reminder.controller.ts†L54-L67】【F:src/reminder/reminder.service.ts†L54-L69】

### `PATCH /v1/spaces/:spaceId/reminders/:id`
Updates reminder attributes and linked file set.【F:src/reminder/reminder.controller.ts†L69-L83】【F:src/reminder/reminder.service.ts†L71-L113】【F:src/reminder/dto/update-reminder.dto.ts†L1-L24】

**Error states**
- `404 Not Found` if the reminder is missing, belongs to another user, or new fileIds are invalid.【F:src/reminder/reminder.service.ts†L77-L105】【F:src/reminder/reminder.service.ts†L232-L251】

### `DELETE /v1/spaces/:spaceId/reminders/:id`
Deletes a reminder. Returns `204 No Content`.【F:src/reminder/reminder.controller.ts†L84-L92】【F:src/reminder/reminder.service.ts†L115-L130】

### `POST /v1/spaces/:spaceId/reminders/:id/files`
Adds additional files to an existing reminder (duplicates are ignored).【F:src/reminder/reminder.controller.ts†L94-L108】【F:src/reminder/reminder.service.ts†L132-L174】

**Request**
```json
{
  "fileIds": ["3c4d5e6f-7a8b-4c1d-9e2f-345678901234"]
}
```

**Response**
Returns the updated reminder payload (same shape as creation).

**Error states**
- `404 Not Found` if the reminder or files are not found in the space.【F:src/reminder/reminder.service.ts†L138-L171】【F:src/reminder/reminder.service.ts†L232-L251】

### `DELETE /v1/spaces/:spaceId/reminders/:id/files/:fileId`
Removes a linked file from a reminder and returns the updated reminder.【F:src/reminder/reminder.controller.ts†L110-L126】【F:src/reminder/reminder.service.ts†L176-L215】

**Error states**
- `404 Not Found` if the reminder, file, or association does not exist.【F:src/reminder/reminder.service.ts†L182-L207】

## Sessions

Session routes allow users to manage their active refresh sessions; all require a valid access token.【F:src/sessions/session.controller.ts†L16-L55】【F:src/sessions/session.service.ts†L16-L155】

### `GET /v1/sessions`
Lists active sessions (non-revoked, non-expired). Useful for account devices UI.【F:src/sessions/session.controller.ts†L22-L38】【F:src/sessions/session.service.ts†L126-L135】【F:src/sessions/dto/session-response.dto.ts†L1-L8】

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

### `DELETE /v1/sessions/:sessionId`
Revokes a specific refresh session (e.g., logout from one device). Returns `{ "message": "Session invalidated." }`.【F:src/sessions/session.controller.ts†L40-L48】【F:src/sessions/session.service.ts†L144-L149】

### `DELETE /v1/sessions`
Revokes every active session for the user. Returns `{ "message": "All sessions invalidated." }`.【F:src/sessions/session.controller.ts†L50-L55】【F:src/sessions/session.service.ts†L151-L155】

**Error states (for both deletes)**
- `401 Unauthorized` if the session id is unknown, revoked, or expired; the service treats these as unauthorized session manipulations.【F:src/sessions/session.service.ts†L40-L121】
