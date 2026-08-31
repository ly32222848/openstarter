// getPublicAnalyticsConfig 白名单扩展测试：vi.mock 掉 getAllConfigs，
// 锁定「新三键正确映射、旧三键不变、绝不多发其它键」的契约。

import { describe, expect, it, vi } from "vitest";

vi.mock("@openstarter/shared/config", () => ({
  getAllConfigs: vi.fn(async () => ({
    ga_mobile_enabled: "true",
    google_analytics_id: "G-ABC123",
    openpanel_client_id: " op-client ",
    openpanel_client_secret: "op-secret",
    plausible_domain: "example.com",
    // 干扰项：绝不允许出现在公开配置里
    stripe_secret_key: "sk_live_danger",
  })),
}));

import { getPublicAnalyticsConfig } from "./service";

describe("getPublicAnalyticsConfig — mobile keys", () => {
  it("returns the three new mobile keys alongside the legacy web keys", async () => {
    const config = await getPublicAnalyticsConfig();

    expect(config).toEqual({
      gaMobileEnabled: true,
      googleAnalyticsId: "G-ABC123",
      openpanelClientId: "op-client",
      openpanelClientSecret: "op-secret",
      plausibleDomain: "example.com",
      plausibleSrc: "",
    });
  });
});
