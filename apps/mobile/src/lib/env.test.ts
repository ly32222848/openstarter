import { describe, expect, it } from "vitest";

import { BUILD_FLAGS, getBuildTimeFlag, getRevenueCatApiKey, resolveApiUrl } from "./env";

describe("resolveApiUrl", () => {
  it("accepts an absolute http URL", () => {
    expect(resolveApiUrl("http://192.168.1.100:3000")).toEqual({
      apiUrl: "http://192.168.1.100:3000",
      ok: true,
    });
  });

  it("accepts an absolute https URL", () => {
    expect(resolveApiUrl("https://app.example.com")).toEqual({
      apiUrl: "https://app.example.com",
      ok: true,
    });
  });

  it("strips a trailing slash so joined paths never double up", () => {
    expect(resolveApiUrl("https://app.example.com/")).toEqual({
      apiUrl: "https://app.example.com",
      ok: true,
    });
  });

  it("fails when the value is missing", () => {
    expect(resolveApiUrl(undefined)).toEqual({
      ok: false,
      reason: "EXPO_PUBLIC_API_URL is not set",
    });
  });

  it("fails when the value is an empty string", () => {
    expect(resolveApiUrl("")).toEqual({
      ok: false,
      reason: "EXPO_PUBLIC_API_URL is not set",
    });
  });

  it("fails when the value is not a valid absolute URL", () => {
    const result = resolveApiUrl("localhost:3000");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("localhost:3000");
    }
  });

  it("fails when the value is a relative path", () => {
    const result = resolveApiUrl("/api");

    expect(result.ok).toBe(false);
  });
});

describe("getRevenueCatApiKey", () => {
  const ORIGINAL = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;

  it("returns the trimmed key when present", () => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = "appl_abc123";
    expect(getRevenueCatApiKey()).toBe("appl_abc123");
  });

  it("returns null when absent", () => {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
    expect(getRevenueCatApiKey()).toBeNull();
  });

  it("returns null for a blank value", () => {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = "   ";
    expect(getRevenueCatApiKey()).toBeNull();
  });

  if (ORIGINAL === undefined) {
    delete process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  } else {
    process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = ORIGINAL;
  }
});

describe("getBuildTimeFlag", () => {
  const NAME = "EXPO_PUBLIC_TEST_FLAG";
  const ORIGINAL_FLAG = process.env[NAME];

  it('is on only for the exact "true" value', () => {
    process.env[NAME] = "true";
    expect(getBuildTimeFlag(NAME)).toBe(true);
  });

  it("rejects loose truthy values", () => {
    for (const value of ["false", "1", "TRUE", "on", ""]) {
      process.env[NAME] = value;
      expect(getBuildTimeFlag(NAME)).toBe(false);
    }
  });

  it("is off when the variable is missing", () => {
    delete process.env[NAME];
    expect(getBuildTimeFlag(NAME)).toBe(false);
  });

  it("exposes the canonical IAP flag name", () => {
    expect(BUILD_FLAGS.iapEnabled).toBe("EXPO_PUBLIC_IAP_ENABLED");
  });

  if (ORIGINAL_FLAG === undefined) {
    delete process.env[NAME];
  } else {
    process.env[NAME] = ORIGINAL_FLAG;
  }
});
