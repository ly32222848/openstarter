import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";

import { resolveFileUrl } from "../config/resolve-file-url";
import { isCloudflareWorker } from "../utils/runtime";
import * as schema from "../schema";
import type { Database, DbConfig } from "../types";

// libsql/SQLite singleton (Node only).
let sqliteDbInstance: Database | null = null;

/**
 * Create a libsql-backed Drizzle database (SQLite local file or Turso remote).
 *
 * On Cloudflare Workers a fresh client is created per call; in Node the
 * instance is cached when `singleton` is enabled.
 */
export function createSqliteDb(config: DbConfig): Database {
  let { url, authToken } = config;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  // Resolve relative file: URLs against the monorepo root so the runtime and
  // drizzle-kit always land on the same database file.
  url = resolveFileUrl(url, resolve(dirname(fileURLToPath(import.meta.url)), "../../../.."));

  const clientConfig = authToken ? { url, authToken } : { url };

  if (isCloudflareWorker) {
    return drizzle({ client: createClient(clientConfig), schema });
  }

  if (config.singleton) {
    if (!sqliteDbInstance) {
      sqliteDbInstance = drizzle({ client: createClient(clientConfig), schema });
    }
    return sqliteDbInstance;
  }

  return drizzle({ client: createClient(clientConfig), schema });
}
