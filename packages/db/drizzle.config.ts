import { buildConfigFor, resolveDbUrl } from "./src/config/drizzle.shared";

/**
 * drizzle-kit config for LOCAL DEVELOPMENT.
 *
 * Local dev always runs on the repo-root SQLite database, regardless of
 * `DATABASE_URL` / `DATABASE_PROVIDER` in `.env` — the prod config
 * (`drizzle.config.prod.ts`) is where cloud targets are managed. The `file:`
 * URL is resolved against the monorepo root, matching the runtime driver, so
 * drizzle-kit commands land on the same `local.db` the app uses and never
 * create stray files under `packages/db/`.
 *
 * Cloud credentials (CLOUDFLARE_*, DATABASE_AUTH_TOKEN, …) are never read
 * here.
 */

export default buildConfigFor("sqlite", resolveDbUrl("file:local.db"));
