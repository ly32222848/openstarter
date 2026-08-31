// config 解析测试：/api/analytics/config 响应 → MobileAnalyticsConfig。
// 任意 shape 的响应都不能抛错（属性测试），键组合语义由单元用例锁定。

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { resolveMobileAnalyticsConfig } from "./config";

describe("resolveMobileAnalyticsConfig — unit", () => {
  it("returns disabled config for undefined/null responses", () => {
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
        gaMobileEnabled: "false",
        openpanelClientId: "",
        openpanelClientSecret: "",
      }),
    ).toEqual({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
  });

  it("trims string values and converts gaMobileEnabled strictly", () => {
    expect(
      resolveMobileAnalyticsConfig({
        gaMobileEnabled: "true",
        openpanelClientId: " op-client ",
        openpanelClientSecret: "op-secret",
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
        gaMobileEnabled: 1,
        openpanelClientId: 42,
        openpanelClientSecret: null,
      }),
    ).toEqual({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
  });
});

describe("resolveMobileAnalyticsConfig — property", () => {
  it("never throws and always returns a valid config for arbitrary input", () => {
    const arbitraryRecord: fc.Arbitrary<unknown> = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.record({
        gaMobileEnabled: fc.oneof(fc.string(), fc.integer(), fc.boolean(), fc.constant(null)),
        openpanelClientId: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
        openpanelClientSecret: fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
      }),
      fc.anything(),
    );

    fc.assert(
      fc.property(arbitraryRecord, (input) => {
        const config = resolveMobileAnalyticsConfig(
          input as Record<string, unknown> | undefined | null,
        );
        expect(typeof config.gaMobileEnabled).toBe("boolean");
        expect(typeof config.openpanelClientId).toBe("string");
        expect(typeof config.openpanelClientSecret).toBe("string");
      }),
    );
  });
});
