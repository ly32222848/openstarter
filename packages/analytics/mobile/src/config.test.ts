// config 解析测试：构建期 env（EXPO_PUBLIC_*）→ MobileAnalyticsConfig。
// 任意 shape 的 env 都不能抛错（属性测试），键组合语义由单元用例锁定。

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { ANALYTICS_ENV_KEYS, resolveMobileAnalyticsConfig } from "./config";

describe("resolveMobileAnalyticsConfig — unit", () => {
  it("returns disabled config for undefined/null env", () => {
    expect(resolveMobileAnalyticsConfig(undefined)).toEqual({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
    expect(resolveMobileAnalyticsConfig(null)).toEqual({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
  });

  it("maps empty/missing keys to disabled config", () => {
    expect(resolveMobileAnalyticsConfig({})).toEqual({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
    expect(
      resolveMobileAnalyticsConfig({
        EXPO_PUBLIC_ANALYTICS_GA_ENABLED: "false",
        EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID: "",
        EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_SECRET: "",
      }),
    ).toEqual({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
  });

  it("trims string values and converts the GA switch strictly", () => {
    expect(
      resolveMobileAnalyticsConfig({
        EXPO_PUBLIC_ANALYTICS_GA_ENABLED: "true",
        EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID: " op-client ",
        EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_SECRET: "op-secret",
      }),
    ).toEqual({
      gaMobileEnabled: true,
      openpanelClientId: "op-client",
      openpanelClientSecret: "op-secret",
    });
  });

  it("treats non-string values as unconfigured (never throws on shape)", () => {
    expect(
      resolveMobileAnalyticsConfig({
        EXPO_PUBLIC_ANALYTICS_GA_ENABLED: 1,
        EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID: 42,
        EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_SECRET: null,
      } as unknown as Record<string, string | undefined>),
    ).toEqual({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
  });

  it("exposes the canonical env key names", () => {
    expect(ANALYTICS_ENV_KEYS.gaEnabled).toBe("EXPO_PUBLIC_ANALYTICS_GA_ENABLED");
    expect(ANALYTICS_ENV_KEYS.openpanelClientId).toBe("EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID");
    expect(ANALYTICS_ENV_KEYS.openpanelClientSecret).toBe(
      "EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_SECRET",
    );
  });
});

describe("resolveMobileAnalyticsConfig — property", () => {
  it("never throws and always returns a valid config for arbitrary input", () => {
    const arbitraryRecord: fc.Arbitrary<unknown> = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.record({
        EXPO_PUBLIC_ANALYTICS_GA_ENABLED: fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
        ),
        EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_ID: fc.oneof(
          fc.string(),
          fc.integer(),
          fc.constant(null),
        ),
        EXPO_PUBLIC_ANALYTICS_OPENPANEL_CLIENT_SECRET: fc.oneof(
          fc.string(),
          fc.integer(),
          fc.constant(null),
        ),
      }),
      fc.anything(),
    );

    fc.assert(
      fc.property(arbitraryRecord, (input) => {
        const config = resolveMobileAnalyticsConfig(
          input as Record<string, string | undefined> | undefined | null,
        );
        expect(typeof config.gaMobileEnabled).toBe("boolean");
        expect(typeof config.openpanelClientId).toBe("string");
        expect(typeof config.openpanelClientSecret).toBe("string");
      }),
    );
  });
});
