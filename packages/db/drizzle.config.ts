import { resolve } from "node:path";

import { config as loadEnv } from "dotenv";

import { buildConfigFor, repoRoot, resolveDbUrl } from "./src/config/drizzle.shared";

/**
 * drizzle-kit config for LOCAL DEVELOPMENT.
 *
 * Local dev runs on a SQLite database resolved against the repo root (the
 * same rule the runtime driver applies), so drizzle-kit commands and the
 * running app always land on the same file. A `file:` URL from the repo-root
 * `.env` (or the environment) is honored; anything else (postgres://, libsql://
 * …) is ignored here — cloud targets are managed by `drizzle.config.prod.ts`.
 */

loadEnv({ path: resolve(repoRoot, ".env") });

const envUrl = process.env.DATABASE_URL;
const localUrl = envUrl?.startsWith("file:") ? envUrl : "file:local.db";

export default buildConfigFor("sqlite", resolveDbUrl(localUrl));
