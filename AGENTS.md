# Repository Guidelines

## Project Structure & Module Organization
The NestJS application lives in `src`. `main.ts` bootstraps the HTTP server and `app.module.ts` composes feature modules. The `auth` module owns authentication flows, `mail` encapsulates outbound email, and `src/prisma` exposes the shared Prisma client. Database models and migrations are stored in `prisma/`, with reusable seed helpers in `prisma/seed.ts`. Co-locate unit specs with the code they exercise and keep the `*.spec.ts` suffix for discoverability.

## Build, Test, and Development Commands
- `pnpm install` installs backend dependencies in line with `package.json`.
- `pnpm start:dev` runs `nest start --watch` for hot-reload development.
- `pnpm build` compiles TypeScript to `dist/` for production runs.
- `pnpm test`, `pnpm test:watch`, and `pnpm test:cov` execute Jest unit suites (watch and coverage variants included).
- `pnpm test:e2e` is wired for end-to-end suites; add a `test/jest-e2e.json` config before first use.
- `pnpm seed` runs `prisma/seed.ts` to refresh local data fixtures.

## Coding Style & Naming Conventions
Use Prettier defaults (2-space indent, single quotes, trailing commas) and run `pnpm format` before committing. TypeScript symbols such as services, controllers, and DTOs stay in PascalCase (`AuthService`, `CreateSessionDto`), while variables remain camelCase. Keep Nest modules small and focused, and prefer dependency injection via constructors. Lint with `pnpm lint`; do not suppress rules without consensus.

## Testing Guidelines
Jest is preconfigured via `ts-jest`; mirror source paths when adding specs (for example, `auth.service.spec.ts`). Structure tests around behaviors, mocking external calls with Nest testing modules or Prisma test clients. Target rising coverage—`pnpm test:cov` outputs reports under `coverage/`. When data setup is required, rely on Prisma factories or the seeding utilities instead of hitting live services.

## Commit & Pull Request Guidelines
Adopt the Conventional Commit pattern already in the history (`feat: update password reset flow`, `fix: guard prisma errors`). Keep commits focused and ensure linting/formatting is clean. PRs should link issues or tasks, outline test commands run, and call out API or schema changes. Add screenshots, sample curl requests, or migration notes when they help reviewers.

## Environment & Database Tips
Duplicate `.env.example` into `.env` and supply local secrets (`DATABASE_URL`, mail provider keys) before starting the app. Apply migrations with `pnpm prisma migrate dev` whenever `prisma/schema.prisma` changes. Never commit secrets; surface new configuration via `ConfigModule.forRoot` so values load from the environment consistently.
