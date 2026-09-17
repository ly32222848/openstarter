import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("drizzle.config.prod", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the D1 d1-http driver when credentials are present", async () => {
    vi.stubEnv("DATABASE_PROVIDER", "d1");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acct");
    vi.stubEnv("CLOUDFLARE_DATABASE_ID", "dbid");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");

    const { default: config } = await import("../../drizzle.config.prod");
    expect(config).toMatchObject({ dialect: "sqlite", driver: "d1-http" });
  });

  it("throws a clear error when D1 credentials are missing", async () => {
    vi.stubEnv("DATABASE_PROVIDER", "d1");
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "");
    vi.stubEnv("CLOUDFLARE_DATABASE_ID", "");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "");

    await expect(import("../../drizzle.config.prod")).rejects.toThrow(/CLOUDFLARE_ACCOUNT_ID/);
  });

  it("switches to the postgres dialect when DATABASE_PROVIDER=postgres", async () => {
    vi.stubEnv("DATABASE_PROVIDER", "postgres");
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@host:5432/app");

    const { default: config } = await import("../../drizzle.config.prod");
    expect(config).toMatchObject({ dialect: "postgresql" });
  });
});
