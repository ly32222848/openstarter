import { describe, expect, it } from "vitest";

import { getRevenueCatApiKey, resolveApiUrl } from "./env";

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
