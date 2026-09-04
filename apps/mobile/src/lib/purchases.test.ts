// RC 门面测试：幂等初始化 / 能力不可用全 no-op / SDK 签名对齐。
// 门面持有模块级 configured 状态 —— 每个用例 resetModules 后动态 import，
// 保证用例间状态隔离（不依赖书写顺序）。

import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  configure: vi.fn(),
  logIn: vi.fn(),
  logOut: vi.fn(),
  restorePurchases: vi.fn(),
  addCustomerInfoUpdateListener: vi.fn(),
  removeCustomerInfoUpdateListener: vi.fn(),
}));

const env = vi.hoisted(() => ({
  getRevenueCatApiKey: vi.fn<() => string | null>(() => null),
}));

vi.mock("@openstarter/billing-mobile", () => ({
  Purchases: sdk,
}));

vi.mock("./env", () => ({ getRevenueCatApiKey: env.getRevenueCatApiKey }));

async function importFacade(): Promise<typeof import("./purchases")> {
  await vi.resetModules();
  return import("./purchases");
}

beforeEach(() => {
  for (const mock of Object.values(sdk)) {
    mock.mockReset();
  }
  env.getRevenueCatApiKey.mockReset();
  env.getRevenueCatApiKey.mockReturnValue(null);
});

describe("initPurchases", () => {
  it("reports unavailable before initialization", async () => {
    const facade = await importFacade();
    expect(facade.isPurchasesAvailable()).toBe(false);
  });

  it("is a no-op without an SDK key and stays unavailable", async () => {
    const facade = await importFacade();

    await expect(facade.initPurchases()).resolves.toBe(false);

    expect(sdk.configure).not.toHaveBeenCalled();
    expect(facade.isPurchasesAvailable()).toBe(false);
  });

  it("configures the SDK once when a key is present (shared init promise)", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();

    const [first, second] = await Promise.all([
      facade.initPurchases(),
      facade.initPurchases(),
    ]);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(sdk.configure).toHaveBeenCalledTimes(1);
    expect(sdk.configure).toHaveBeenCalledWith({ apiKey: "appl_test_key" });
    expect(facade.isPurchasesAvailable()).toBe(true);
  });

  it("degrades to unavailable when configure throws (no native module)", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    sdk.configure.mockImplementation(() => {
      throw new Error("native module missing");
    });
    const facade = await importFacade();

    await expect(facade.initPurchases()).resolves.toBe(false);
    expect(facade.isPurchasesAvailable()).toBe(false);
  });
});

describe("identify / resetPurchases", () => {
  it("never reaches the SDK while unconfigured (no key)", async () => {
    const facade = await importFacade();

    await facade.identify("user-1");
    await facade.resetPurchases();

    expect(sdk.logIn).not.toHaveBeenCalled();
    expect(sdk.logOut).not.toHaveBeenCalled();
  });

  it("binds the better-auth userId as the RC app_user_id on logIn", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();

    // identify 自身触发初始化 —— 无需先单独调 initPurchases。
    await facade.identify("user-1");

    expect(sdk.logIn).toHaveBeenCalledWith("user-1");
  });

  it("ignores empty userIds", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();

    await facade.identify("");

    expect(sdk.logIn).not.toHaveBeenCalled();
  });

  it("swallows logIn failures", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    sdk.logIn.mockRejectedValue(new Error("network"));
    const facade = await importFacade();

    await expect(facade.identify("user-1")).resolves.toBeUndefined();
  });

  it("calls logOut on reset when configured", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();

    await facade.resetPurchases();

    expect(sdk.logOut).toHaveBeenCalledTimes(1);
  });

  it("swallows logOut failures", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    sdk.logOut.mockRejectedValue(new Error("network"));
    const facade = await importFacade();

    await expect(facade.resetPurchases()).resolves.toBeUndefined();
  });
});

describe("restorePurchases", () => {
  it("returns false while unavailable (no key)", async () => {
    const facade = await importFacade();
    expect(await facade.restorePurchases()).toBe(false);
  });

  it("reports whether active subscriptions survived the restore", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();
    await facade.initPurchases();
    sdk.restorePurchases.mockResolvedValue({ activeSubscriptions: ["pro_monthly"] });

    expect(await facade.restorePurchases()).toBe(true);
  });

  it("returns false when no active subscriptions exist", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();
    await facade.initPurchases();
    sdk.restorePurchases.mockResolvedValue({ activeSubscriptions: [] });

    expect(await facade.restorePurchases()).toBe(false);
  });

  it("returns false when the SDK rejects (user cancel / network)", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();
    await facade.initPurchases();
    sdk.restorePurchases.mockRejectedValue(new Error("cancelled"));

    expect(await facade.restorePurchases()).toBe(false);
  });
});

describe("addCustomerInfoUpdateListener", () => {
  it("returns a no-op unsubscribe while unavailable", async () => {
    const facade = await importFacade();
    const unsubscribe = facade.addCustomerInfoUpdateListener(() => undefined);

    expect(() => unsubscribe()).not.toThrow();
    expect(sdk.addCustomerInfoUpdateListener).not.toHaveBeenCalled();
  });

  it("registers the listener and removes the same reference on unsubscribe", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();
    await facade.initPurchases();
    const listener = () => undefined;

    const unsubscribe = facade.addCustomerInfoUpdateListener(listener);
    unsubscribe();

    expect(sdk.addCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
    expect(sdk.removeCustomerInfoUpdateListener).toHaveBeenCalledWith(listener);
  });

  it("does not throw when removal fails after teardown", async () => {
    env.getRevenueCatApiKey.mockReturnValue("appl_test_key");
    const facade = await importFacade();
    await facade.initPurchases();
    sdk.removeCustomerInfoUpdateListener.mockImplementation(() => {
      throw new Error("already torn down");
    });

    const unsubscribe = facade.addCustomerInfoUpdateListener(() => undefined);

    expect(() => unsubscribe()).not.toThrow();
  });
});
