import { describe, expect, it } from "vitest";

import {
  resolveEnabledProviders,
  resolveIapEnabled,
  resolvePasswordlessModes,
} from "./public-config";

describe("resolveEnabledProviders", () => {
  it("treats an empty config as email-only with no social providers", () => {
    expect(resolveEnabledProviders({})).toEqual({
      emailPassword: true,
      passwordReset: false,
      socialProviders: [],
    });
  });

  it("disables email/password only on an explicit false", () => {
    expect(resolveEnabledProviders({ email_auth_enabled: "false" }).emailPassword).toBe(false);
    expect(resolveEnabledProviders({ email_auth_enabled: "true" }).emailPassword).toBe(true);
  });

  it('enables google when its switch is exactly "true"', () => {
    expect(resolveEnabledProviders({ google_auth_enabled: "true" }).socialProviders).toEqual([
      "google",
    ]);
  });

  it("does not enable google for any other value", () => {
    for (const value of ["false", "1", "TRUE", ""]) {
      expect(resolveEnabledProviders({ google_auth_enabled: value }).socialProviders).toEqual([]);
    }
  });

  it("returns providers in a stable order regardless of config key order", () => {
    expect(
      resolveEnabledProviders({
        apple_auth_enabled: "true",
        google_auth_enabled: "true",
      }).socialProviders,
    ).toEqual(["google", "apple"]);
  });

  it("ignores github even when the server reports it enabled", () => {
    expect(resolveEnabledProviders({ github_auth_enabled: "true" }).socialProviders).toEqual([]);
  });

  it("reads password reset straight from the derived server flag", () => {
    expect(resolveEnabledProviders({ password_reset_enabled: "true" }).passwordReset).toBe(true);
    expect(resolveEnabledProviders({ password_reset_enabled: "false" }).passwordReset).toBe(false);
  });
});

describe("resolvePasswordlessModes", () => {
  it("returns both modes off for an empty config", () => {
    expect(resolvePasswordlessModes({})).toEqual({ emailOtp: false, magicLink: false });
  });

  it('enables each mode only on the exact "true" value', () => {
    expect(resolvePasswordlessModes({ magic_link_enabled: "true" }).magicLink).toBe(true);
    expect(resolvePasswordlessModes({ email_otp_enabled: "true" }).emailOtp).toBe(true);
  });

  it("rejects loose truthy values", () => {
    for (const value of ["false", "1", "TRUE", "on", ""]) {
      expect(resolvePasswordlessModes({ magic_link_enabled: value }).magicLink).toBe(false);
      expect(resolvePasswordlessModes({ email_otp_enabled: value }).emailOtp).toBe(false);
    }
  });
});

describe("resolveIapEnabled", () => {
  it("is off for an empty config", () => {
    expect(resolveIapEnabled({})).toBe(false);
  });

  it('is on only for the exact "true" value', () => {
    expect(resolveIapEnabled({ revenuecat_enabled: "true" })).toBe(true);
    for (const value of ["false", "1", "TRUE", ""]) {
      expect(resolveIapEnabled({ revenuecat_enabled: value })).toBe(false);
    }
  });
});
