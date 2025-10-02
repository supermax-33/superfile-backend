# Superfile Backend – Application Overview

This manual describes the end-to-end behavior of the Superfile backend so new contributors can understand how features fit together and where to extend them. The service is a NestJS monolith that exposes a versioned REST API for secure collaboration around AI-assisted file knowledge within shared “spaces”.

## 1. Platform Summary
- NestJS HTTP application written in TypeScript and organized by feature modules under `src/`.
- PostgreSQL persistence managed through Prisma with schema defined in `prisma/schema.prisma` and reusable seeding in `prisma/seed.ts`.
- REST interface exposed under the global prefix `/api` with URI versioning (`/api/v1/...`) configured in `src/main.ts`.
- Core capabilities: user authentication (local + Google), refresh-session management, space and membership control, file ingest & sharing, OpenAI-backed conversations, reminders, and outbound email notifications.
- Critical integrations: AWS S3 (file storage & presigned URLs), OpenAI Vector Stores + Responses API (retrieval-augmented chat), Resend (transactional email), Google OAuth (optional social login).
- JWT-based stateless access tokens paired with database-backed refresh sessions for reuse protection and device management.
- Authorization hinges on space-scoped roles (`viewer`, `editor`, `manager`, `owner`) resolved through a custom guard before feature operations execute.

## 2. Runtime Architecture
- `src/main.ts` bootstraps the Nest app, adds a global `ValidationPipe` (payload whitelisting, unknown property rejection, DTO transformation), sets the `/api` prefix, and enables URI versioning so routes declare `@Version('1')`.
- `src/app.module.ts` loads `ConfigModule` globally and composes the feature modules below.

| Module | Responsibilities | Highlights |
| --- | --- | --- |
| `PrismaModule` | Shares a single Prisma client (`PrismaService`) across the app. | Handles connection lifecycle (`$connect`/`$disconnect`). |
| `AuthModule` | Local + Google auth flows, OTP verification, password resets, JWT issuance. | Integrates `JwtModule`, `Passport` strategies, `MailModule`, `SessionModule`, and exposes `AuthController`. |
| `SessionModule` | Refresh-session lifecycle APIs and helpers. | Hashes refresh tokens, detects reuse, powers `JwtStrategy` validation. |
| `SpaceModule` | CRUD for spaces and logos. | Provisions OpenAI vector stores on create, enforces owner permissions via `SpaceRoleGuard`. |
| `SpaceMemberModule` | Membership management and role enforcement utilities. | Exports `SpaceRoleGuard` + decorator to other modules. |
| `SpaceInvitationModule` | Invitation lifecycle (create, list, accept/reject). | Generates secure tokens, emails recipients, and grants memberships on acceptance. |
| `FileModule` | File ingestion, metadata, download, and sharing. | Streams uploads to S3, ingests files into OpenAI vector stores, tracks progress, and manages share links/emails. |
| `ConversationModule` | AI assistant conversations bound to spaces. | Streams SSE responses from OpenAI with file-search context and persists transcripts. |
| `ReminderModule` | Space-scoped reminders linked to files. | Enforces editor/manager roles, normalizes linked file associations. |
| `MailModule` | Outbound email abstraction. | Wraps the Resend API for verification, reset, and share notifications. |
| `OpenAiModule` | OpenAI client and vector store helper. | Centralizes vector store/file operations with retry-safe deletions. |

## 3. Domain Concepts
### Users
End-user accounts stored in the `User` model. Users can authenticate via local credentials (`provider = LOCAL`) or Google OAuth (`provider = GOOGLE`). Email verification status gates access for local accounts. Related tables hold verification OTPs, password reset codes, owned spaces, memberships, and persisted refresh sessions.

### Sessions
Refresh sessions represent device logins and power token rotation. Each session stores the hashed refresh token, previous hash (for reuse detection), device metadata (IP, User-Agent), expiry, and revocation timestamp. Access tokens embed a `sid` claim referencing these rows so `JwtStrategy` can assert session validity on every request.

### Spaces
A space is a collaborative container owned by a single user. Each space has a human-friendly name, slug, optional logo, and an OpenAI vector store ID used for file-search. Creating a space automatically grants the owner the `OWNER` membership role.

### Space Members & Roles
Memberships connect users to spaces with a role chosen from `SpaceRole` (`VIEWER`, `EDITOR`, `MANAGER`, `OWNER`). Roles determine privileges across files, reminders, and conversations. The custom `SpaceRoleGuard` inspects route metadata to resolve the relevant space and assert the caller’s role before entering the handler.

### Space Invitations
Invitations let space owners and managers onboard collaborators securely by email. Each `SpaceInvitation` stores the invited email, inviter, requested role, status (`PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`), secure token hash, and expiry timestamp. Pending invitations dispatch transactional emails with accept/decline links. Accepting an invitation (while authenticated with the invited email) grants or updates the membership to the stored role; declining or expiry updates the status without modifying memberships.

### Files
Files belong to spaces and move through `FileStatus` states (`PROCESSING`, `SUCCESS`, `FAILED`). Each record tracks the S3 object key, allowed MIME type (`application/pdf`), upload size (stored as bigint), OpenAI file identifiers, optional note, current error message, and timestamps. Files can be linked to reminders, conversations, and shared externally via tokens.

### File Shares
A share is a tokenized grant to download a single file without authenticating. Shares store the owning space, the associated file, an optional expiry, and sender note. Public resolution returns a short-lived S3 presigned URL generated on demand.

### Conversations & Messages
Conversations organize chat history between a space member and the AI assistant. Messages record role (`USER` or `ASSISTANT`), content, timestamps, and optional references to space files that informed the response. Conversations inherit the space’s vector store to perform file-search during assistant replies.

### Reminders
Reminders schedule follow-up actions inside a space. Each reminder stores a title, optional note, reminder timestamp, and links to zero or more files. Reminders can also be associated with conversation messages to capture AI-generated action items.

## 4. Feature Modules and Capabilities
### Authentication (`src/auth`)
- **Signup & verification**: `POST /api/v1/auth/signup` creates a local account, hashes the password with bcrypt, marks it unverified, and stores a verification OTP in `VerificationToken`. `MailService` dispatches the code via Resend. `/auth/verify-email` confirms the code and flips `emailVerified`.
- **OTP management**: `/auth/resend-otp` invalidates previous unused codes before generating and emailing a fresh OTP so only one token remains valid at a time.
- **Login & token issuance**: `/auth/login` requires a verified local account. `AuthService.issueTokens` returns access/refresh JWTs, provisioning a session row and storing request metadata (IP + User-Agent). Refresh tokens embed a `type=refresh` claim and the session ID.
- **Refresh flow**: `/auth/refresh-token` verifies the JWT signature, checks the `sid` claim, and calls `SessionService.validateSessionToken`. Refresh reuse triggers `SessionService.revokeAllSessionsForUser` to protect against replay.
- **Password maintenance**: `/auth/change-password` enforces current password validation and revokes all sessions on success. `/auth/forgot-password` issues a reset OTP emailed to the user; `/auth/verify-reset-code` trades that for a short-lived access token used by `/auth/reset-password` to set a new password and revoke sessions.
- **Google OAuth**: The app exposes both browser (`GET /auth/google`, `GET /auth/google/callback`) and mobile (`POST /auth/google/token`) entry points. Profiles are upserted into `User`, automatically marking emails verified and switching provider metadata when appropriate.
- **Guards & filters**: `JwtAuthGuard` wraps protected routes; `JwtExceptionFilter` normalizes 401 responses for expired/invalid JWTs.

### Sessions (`src/sessions`)
- `SessionService` encapsulates session creation, rotation (hashing new refresh tokens and storing the old hash), validation (hash comparison with both current and previous tokens), reuse detection, listing, and revocation.
- `SessionController` exposes `/api/v1/sessions` for listing active devices and `/api/v1/sessions/:id` or `/api/v1/sessions` (DELETE) to invalidate one or all sessions. Every endpoint requires a valid access token.

### Spaces (`src/space`)
- `SpaceService.create` normalizes the provided name/slug, provisions an OpenAI vector store (prefix `superfile-space-...`), creates the space record, and inserts the owner as an `OWNER` member within a single transaction. Vector stores are cleaned up if DB writes fail.
- `PATCH /spaces/:id` (owner-only) updates the name/slug; the service validates non-empty values. `DELETE` removes the space and attempts to delete the associated vector store first.
- `PUT /spaces/:id/logo` accepts a Multer-uploaded image, stores the raw bytes in `SpaceLogo`, and tracks a SHA-256 hash for cache busting.
- `GET /spaces/:id` requires at least `VIEWER` access and returns serialized metadata including logo hashes.

### Space Members (`src/space-member`)
- Owners can list (`GET`), add (`POST`), update roles (`PATCH`), and remove (`DELETE`) members under `/spaces/:spaceId/members`.
- `SpaceMemberService` enforces owner-only management, prevents self-demotion/removal, bans assigning the `OWNER` role, and resolves space IDs when guards need to link resources like files or reminders back to a space.
- `SpaceRoleGuard` inspects metadata set by the `@RequireSpaceRole` decorator to fetch the relevant space via params, body, query, file, conversation, or reminder associations and injects the membership into `request.spaceMembership` for downstream use.

### Space Invitations (`src/space-invitation`)
- Owners and managers send invitations via `POST /api/v1/spaces/:spaceId/invitations`; the service normalizes the email, validates the optional `role` (defaults to `VIEWER`), expires stale records, prevents duplicate pending invites, and queues accept/reject emails through `MailService`.
- `GET /api/v1/spaces/:spaceId/invitations` returns pending and historical invitations (newly expired rows are marked `EXPIRED` on read) so admins can audit outstanding requests.
- `PATCH /api/v1/spaces/:spaceId/invitations/:invitationId/role` lets managers adjust the requested role for pending invites or update an accepted member's role without touching the dedicated member management endpoints.
- Invitees accept through `POST /api/v1/spaces/invitations/:invitationId/accept?token=...` while authenticated with the invited email. Acceptance creates or updates the membership to the invitation role and flips the invitation to `ACCEPTED`.
- Declines hit `POST /api/v1/spaces/invitations/:invitationId/reject?token=...`, updating the status to `REJECTED` without altering memberships.

### Files & Sharing (`src/file`)
- **Upload pipeline**: `/files` uses `FilesInterceptor` with in-memory storage, MIME filtering (`ALLOWED_MIME_TYPES` is currently PDF-only), and a 25 MB per-file limit. `FileService.uploadFiles` verifies the caller has `EDITOR` access, creates DB records with `PROCESSING` status, emits progress snapshots via `FileProgressService`, uploads to S3, then ingests the buffer into the space’s OpenAI vector store. Failures capture error messages and mark files `FAILED`.
- **Listing & metadata**: `/files` (GET) filters by `spaceId` and optional status. `/files/:id/note` lets editors read/update/clear textual notes stored alongside the file.
- **Status & progress**: `/files/:id/progress` returns in-memory upload status; completed uploads return 100%. `/files/:id/status` re-queries OpenAI for ingestion status updates.
- **Downloads**: `/files/:id` streams the S3 object using Nest’s `StreamableFile`, setting headers for filename, type, and length.
- **Deletion**: `/files/:id` (MANAGER) removes the S3 object, deletes the OpenAI file (if present), and drops the DB record. `/files` (DELETE) accepts a batch list, de-duplicates IDs, reports per-file failures, and soft-handles permission errors.
- **Batch download links**: `/files/download` returns short-lived presigned URLs for multiple files when the caller has `VIEWER` rights.
- **Sharing**: `/files/:id/share` creates a token (48 hex chars from 24 random bytes) with optional expiry and note. `/files/:id/shares` lists active shares; `/files/:id/shares/:shareId` revokes them. `/files/:id/share/email` emails a share through `MailService`. `GET /api/v1/share/:token` is the unauthenticated resolver that returns metadata and a presigned URL via `FilePresignedUrlService`.

### Conversations (`src/conversation`)
- `POST /spaces/:spaceId/conversations` creates a conversation (optional custom title toggles `manuallyRenamed`). `GET /spaces/:spaceId/conversations` lists them.
- `GET /conversations/:id/messages` returns chronologically ordered messages with hydrated file references (each includes a fresh presigned download URL).
- `POST /conversations/:id/messages` streams an assistant reply using server-sent events. The service writes the user message, ensures the space has at least one successfully ingested file, and calls `openai.responses.stream` with `gpt-4.1-mini` plus a `file_search` tool bound to the space’s vector store. SSE events:
  - `event: token` payloads emit incremental assistant text deltas.
  - `event: final` contains the persisted assistant message and resolved references. A fallback message (“No files are present…”) is returned immediately if the space lacks usable files.
- `DELETE /conversations/:id` (space `MANAGER`) hard-deletes the conversation and associated messages.

### Reminders (`src/reminder`)
- `/spaces/:spaceId/reminders` supports create (EDITOR), list (VIEWER), read (VIEWER), update (EDITOR), delete (MANAGER), add files (EDITOR), and remove a single linked file (EDITOR).
- `ReminderService` deduplicates provided file IDs, verifies every file belongs to the space, and serializes responses with embedded file metadata (including file status and timestamps).

### Mail (`src/mail`)
- `MailService` centralizes transactional emails with safe HTML formatting and note sanitization. Templates exist for email verification, password reset, file share notifications (with optional expiry and sender note), and space invitations (accept/reject links with expiry hints).
- `ResendService` issues authenticated `fetch` requests to Resend’s `/emails` endpoint using `RESEND_API_KEY`.

### OpenAI Integration (`src/openai`)
- `OpenAiVectorStoreService` handles vector store creation/deletion, file uploads (via `files.create` + `vectorStores.files.createAndPoll`), status polling, and cleanup. 404s from OpenAI are treated as idempotent successes to avoid noisy failures during deletions.
- The service is shared by the space, file, and conversation modules, guaranteeing consistent naming and error formatting through `utils/helpers.formatError`.

### Utilities & Configuration
- `utils/helpers.ts` provides OTP generation, slug/name normalization, sanitized filenames, and S3 key construction. `config.ts` centralizes constants such as OTP length (6 digits), JWT lifetimes (15 m access, 30 d refresh), refresh expiry in ms, allowed MIME types, max file size (25 MB), file upload field, and vector store naming prefix.

## 5. Data Model Overview
| Model | Summary | Notable Fields / Relations |
| --- | --- | --- |
| `User` | Primary account record. | `email`, `passwordHash`, `provider`, `emailVerified`, relations to verification tokens, reset tokens, sessions, owned spaces, memberships. |
| `VerificationToken` | Email verification OTPs. | `verificationToken`, `expiresAt`, `usedAt`, linked to `User`. |
| `PasswordResetToken` | Password reset codes. | Similar structure to verification tokens; consumed on use. |
| `Session` | Refresh session/device. | `refreshTokenHash`, `previousTokenHash`, metadata, `expiresAt`, `revokedAt`, belongs to a `User`. |
| `Space` | Collaborative container. | `slug`, `ownerId`, `vectorStoreId`, logo relation, files, conversations, reminders, members, `FileShare`. |
| `SpaceMember` | User-role mapping per space. | `role` enum, unique constraint on (`spaceId`, `userId`). |
| `SpaceInvitation` | Pending email invitation to a space. | `email`, `invitedBy`, `role`, `status`, `tokenHash`, `expiresAt`; links to `Space` + inviting `User`. |
| `SpaceLogo` | Binary logo storage. | `data` (`Bytes`), `contentType`, SHA-256 `hash`. |
| `File` | Stored document. | `filename`, `mimetype`, `size`, `status`, `s3Key`, `vectorStoreId`, `openAiFileId`, `note`, reminder links. |
| `FileShare` | External access token. | `shareToken`, optional `expiresAt`, `note`, belongs to `File` + `Space`. |
| `Conversation` | Chat session. | `title`, `manuallyRenamed`, timestamps, belongs to `Space`. |
| `ConversationMessage` | Individual message. | `role`, `content`, JSON `references` and `actions`, reminder links. |
| `Reminder` | Scheduled task. | `title`, `note`, `remindAt`, belongs to `Space`, links to files & conversation messages. |

## 6. Access Control & Security
- **Validation**: DTO-based validation is enforced globally (whitelisting & transformation) to reject unexpected payloads before hitting controllers.
- **Authentication**: `JwtStrategy` loads the user context for every request, rejects expired tokens manually, and verifies the embedded session via `SessionService.assertSessionIsActive`.
- **Refresh-token safety**: Tokens are bcrypt-hashed before storage. Rotation keeps the previous hash to detect replay; reusing a refresh token revokes every session for that user.
- **Role enforcement**: `@RequireSpaceRole` metadata + `SpaceRoleGuard` authorize requests against the correct space regardless of how the space is referenced (path params, body, related resource). Roles follow an ordered hierarchy (`OWNER` > `MANAGER` > `EDITOR` > `VIEWER`).
- **File restrictions**: Uploads are limited to PDFs ≤ 25 MB; sanitized S3 keys prevent path traversal. Notes and email content are escaped before embedding into HTML emails.
- **Share safety**: Share tokens are cryptographically random, and download URLs are presigned with a short (5-minute) TTL. Expired tokens return a 404-style error to avoid hinting at resource existence.
- **Invitation integrity**: Invitation emails embed SHA-256–hashed tokens (stored server-side) and expire after seven days by default. Acceptance requires authentication with the invited email, preventing unauthorized joins.
- **Error normalization**: `JwtExceptionFilter` standardizes unauthorized responses, while utility helpers ensure caught integration errors include actionable prefixes for logs.

## 7. External Services & Environment
| Integration | Required Environment | Purpose |
| --- | --- | --- |
| PostgreSQL | `DATABASE_URL` | Primary data store for Prisma. |
| JWT signing | `JWT_SECRET` | Symmetric secret for access/refresh tokens. |
| AWS S3 (or compatible) | `AWS_S3_BUCKET`, `AWS_REGION`, plus credentials | Binary file storage, downloads, presigned URLs. |
| OpenAI | `OPENAI_API_KEY` | Vector store lifecycle, file ingest, assistant responses. |
| Resend | `RESEND_API_KEY` | Transactional email delivery. |
| File share URLs | `FILE_SHARE_BASE_URL` (fallback: `APP_BASE_URL` → `APP_URL` → `FRONTEND_URL`) | Base URL embedded in share emails and API responses. |
| Space invitation URLs | `SPACE_INVITATION_BASE_URL` (fallback: `APP_BASE_URL` → `APP_URL` → `FRONTEND_URL`) | Base URL for accept/reject links emailed to invitees. |
| Invitation expiry override | `SPACE_INVITATION_TTL_MS` | Optional override (milliseconds) for invitation validity window (default 7 days). |
| Google OAuth (optional) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Social login configuration and ID token validation. |
| Other configuration | See `config.ts` constants | OTP length/TTL, JWT lifetimes, file constraints, vector store naming prefix. |

Ensure `.env` is created from `.env.example`, populate these values, and keep secrets out of source control.

## 8. End-to-End Feature Flows
1. **Account onboarding**
   1. Client calls `/api/v1/auth/signup` (email + password).
   2. Server stores user (unverified) and emails a 6-digit OTP.
   3. User submits OTP to `/api/v1/auth/verify-email`; `emailVerified` becomes true.
   4. `/api/v1/auth/login` returns JWTs and records a session with device metadata.

2. **Password recovery**
   1. `/auth/forgot-password` issues & emails a reset code regardless of user existence (to avoid disclosure).
   2. `/auth/verify-reset-code` validates the code and returns a 15-minute access token.
   3. `/auth/reset-password` (authenticated by that token) sets the new password and revokes all sessions.

3. **Space creation & membership**
   1. Authenticated owner calls `POST /api/v1/spaces` with name + slug.
   2. Service provisions an OpenAI vector store, creates the space, and inserts the owner membership.
   3. Owners/managers invite teammates via `POST /spaces/:spaceId/invitations`, optionally specifying the desired role. They can revise the role later with `PATCH /spaces/:spaceId/invitations/:invitationId/role` until the invitation is revoked. Direct member insertion via `POST /spaces/:spaceId/members` remains available for existing accounts.
   4. Role-guarded routes enforce capabilities (e.g., only `MANAGER`+ can delete files or conversations).

4. **File ingest & sharing**
   1. An editor uploads PDFs via `POST /files` (multipart with `files[]`), optionally attaching a note.
   2. Files stream to S3; OpenAI ingestion runs afterward. Status and errors are visible through `/files`, `/files/:id/status`, and `/files/:id/progress`.
   3. Successful files can be annotated (`PATCH /files/:id/note`), downloaded, or batch-shared.
   4. An editor generates a share (`POST /files/:id/share`) and optionally emails it to recipients. Public consumers hit `/api/v1/share/:token` to retrieve a presigned URL.

5. **AI conversation loop**
   1. Editor starts a conversation (`POST /spaces/:spaceId/conversations`).
   2. Messages are fetched with `/conversations/:id/messages`.
   3. Client posts to `/conversations/:id/messages` with `Accept: text/event-stream` to receive streaming tokens. The assistant references files via OpenAI file-search; resolved references include presigned URLs for the front-end to present.
   4. Managers can delete conversations if necessary.

6. **Reminders and follow-ups**
   1. Editors create reminders (`POST /spaces/:spaceId/reminders`), optionally linking uploaded files.
   2. Reminders remain accessible to all members with `VIEWER`+ roles and can be updated or enriched with additional files.
   3. Linked files keep permissions in sync through `SpaceRoleGuard` checks.

7. **Session management**
   1. Any authenticated user can list devices via `GET /sessions`.
   2. They can revoke a single device (`DELETE /sessions/:id`) or all (`DELETE /sessions`). The server flags sessions as revoked, causing subsequent token refresh attempts to fail.

## 9. Development Workflow
1. Duplicate `.env.example` → `.env` and populate environment variables described above.
2. Install dependencies: `pnpm install`.
3. Run database migrations: `pnpm prisma migrate dev`.
4. Seed baseline data if desired: `pnpm seed` (creates a verified test user with password `Password@123`).
5. Start the dev server with hot reload: `pnpm start:dev`. Production build: `pnpm build` followed by `node dist/main.js`.
6. Lint and format before commits: `pnpm lint` and `pnpm format`.
7. Review `AGENTS.md` for repository conventions and workflow expectations.

## 10. Testing & Diagnostics
- Unit tests: `pnpm test`; watch mode `pnpm test:watch`; coverage `pnpm test:cov`.
- End-to-end scaffolding: `pnpm test:e2e` (configure `test/jest-e2e.json` before first use).
- Manual API testing guidance lives in `TESTING.md`, including Postman instructions.
- `ENDPOINTS.md` enumerates every route, payload, sample response, and error condition—use it as the authoritative contract reference.
- When diagnosing file ingestion issues, check `File.status`/`error`, confirm S3 object existence via `S3FileStorageService.exists`, and inspect OpenAI file status through `/files/:id/status`.

## 11. Reference Documents & Next Steps
- `ENDPOINTS.md`: exhaustive REST contract reference with sample payloads.
- `TESTING.md`: manual verification checklist and Postman recipes.
- `AGENTS.md`: coding standards, formatting, testing, and commit guidance for contributors.

Armed with this overview, new developers or AI agents can navigate the codebase by module, understand how state flows through Prisma models, and extend features while respecting authentication, authorization, and external service contracts.
