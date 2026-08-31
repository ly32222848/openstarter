// apps/mobile 分析薄壳测试：resolve 转发语义 + useScreenTracking 纯路径。
// mobile 无 @testing-library/react，hook 不渲染组件 —— useScreenTracking
// 的 6 行转发语义已由包内门面测试覆盖，此处验证模块导出完整性 + resolve
// 对不信任响应的归一（mobile 侧真正新增的逻辑）。

import { describe, expect, it, vi } from "vitest";

vi.mock("./api", () => ({
  apiClient: {
    api: { analytics: { config: { $get: vi.fn(async () => ({ ok: false })) } } },
  },
}));

vi.mock("expo-router", () => ({
  usePathname: vi.fn(() => "/"),
}));

import {
  initAnalyticsFromApi,
  resolveMobileAnalyticsConfig,
  useScreenTracking,
} from "./analytics";

describe("module exports", () => {
  it("exposes the app-side analytics surface", () => {
    expect(typeof resolveMobileAnalyticsConfig).toBe("function");
    expect(typeof initAnalyticsFromApi).toBe("function");
    expect(typeof useScreenTracking).toBe("function");
  });
});

describe("resolveMobileAnalyticsConfig re-export", () => {
  it("normalizes an RPC response into MobileAnalyticsConfig", () => {
    expect(
      resolveMobileAnalyticsConfig({
        gaMobileEnabled: "true",
        openpanelClientId: "op-client",
        openpanelClientSecret: "op-secret",
      }),
    ).toEqual({
      gaMobileEnabled: true,
      openpanelClientId: "op-client",
      openpanelClientSecret: "op-secret",
    });
  });

  it("treats garbage responses as unconfigured", () => {
    expect(resolveMobileAnalyticsConfig(undefined)).toEqual({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });
  });
});

describe("initAnalyticsFromApi", () => {
  it("is a no-op (does not throw) when the config endpoint fails", async () => {
    // mock 的 $get 返回 { ok: false }：等价于未配置
    await expect(initAnalyticsFromApi()).resolves.toBeUndefined();
  });
});
