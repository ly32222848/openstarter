# Mobile Analytics (@openstarter/analytics-mobile) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 apps/mobile 增加双通道移动分析（OpenPanel + GA4 Firebase），以 `@openstarter/analytics-mobile` 单包双适配器交付，配置经 `/api/analytics/config` 下发。

**Architecture:** 单包（packages/analytics/mobile）内含门面 `initAnalytics` + 三个 provider（openpanel / firebase / noop），SDK 全部经 peerDependencies（optional）+ 动态 import 隔离，未配置/未安装/初始化失败一律降级为 no-op 或 warn 一次后跳过，永不向业务层抛错。配置数据面在既有 `getPublicAnalyticsConfig` 上扩展三键。

**Tech Stack:** TypeScript、Vitest 4 + fast-check、@openpanel/react-native 1.4.1、@react-native-firebase/app + /analytics 26.3.2、Expo config plugin（Android gradle + iOS build phase）。

**Spec:** `docs/superpowers/specs/2026-08-31-mobile-analytics-design.md`

## Global Constraints

- 仓库语言习惯：TypeScript 函数式、不可变数据（整体替换缓存槽，不就地修改）、Zod 仅在系统边界、中文注释解释「为什么」。
- 文件规模 ~200-400 行、最大 800；函数 <50 行。
- 包 exports 映射照抄 `@openstarter/billing-mobile`：`.` → `./src/index.ts`，`./*` → `./src/*.ts`。
- 新包覆盖率 ≥80%。
- 分析上报永不抛错到业务代码；同一 provider 的同种错误只 warn 一次。
- GA 事件名 sanitize 规则：`/[^A-Za-z0-9_]/` 替换为 `_`，超 40 字符截断（改名发，不丢弃）。
- 配置键白名单语义：`getPublicAnalyticsConfig` 只加不删，绝不下发其它配置项。
- OpenPanel clientSecret 经公开端点下发是**设计决策**（spec §2 决策 1），注释须写明理由。
- firebase / openpanel 的动态 import 失败 = 该 provider 静默降级（console.warn 一次），其余照常。
- `ga_mobile_enabled` 为 false/缺失时 firebase provider 根本不被实例化。
- Firebase 配置文件不入库：gitignore `google-services.json`、`GoogleService-Info.plist`，提供 `.example` 模板。
- 提交格式：`<type>: <description>`（feat/fix/test/chore/docs），无 attribution。

---

### Task 1: 新包骨架 + noop provider

**Files:**
- Create: `packages/analytics/mobile/package.json`
- Create: `packages/analytics/mobile/tsconfig.json`
- Create: `packages/analytics/mobile/vitest.config.ts`
- Create: `packages/analytics/mobile/src/index.ts`
- Create: `packages/analytics/mobile/src/providers/types.ts`
- Create: `packages/analytics/mobile/src/providers/noop.ts`

**Interfaces:**
- Consumes: 无（起始任务）。
- Produces: `AnalyticsProvider` 接口（`name: "openpanel" | "firebase" | "noop"`；`init/track/identify/setUserId/setScreenName` 全部返回 `Promise<void>`）；`createNoopProvider(): AnalyticsProvider`。后续所有 provider 与门面依赖这两者。

- [ ] **Step 1: 写 package.json**

```jsonc
{
  "name": "@openstarter/analytics-mobile",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "default": "./src/index.ts"
    },
    "./*": {
      "default": "./src/*.ts"
    }
  },
  "scripts": {
    "test": "vitest --run",
    "test:coverage": "vitest --run --coverage",
    "check-types": "tsc --noEmit"
  },
  "dependencies": {},
  "peerDependencies": {
    "@openpanel/react-native": "*",
    "@react-native-firebase/analytics": "*",
    "@react-native-firebase/app": "*",
    "expo-application": "*",
    "expo-constants": "*",
    "react": "*",
    "react-native": "*"
  },
  "peerDependenciesMeta": {
    "@openpanel/react-native": { "optional": true },
    "@react-native-firebase/analytics": { "optional": true },
    "@react-native-firebase/app": { "optional": true }
  },
  "devDependencies": {
    "typescript": "catalog:"
  }
}
```

（`dependencies` 留空对象即可，无第三方运行时依赖；devDeps 里加 `vitest` 之外的都不需要——vitest 从根解析。）

- [ ] **Step 2: 写 tsconfig.json 与 vitest.config.ts**

`tsconfig.json`（照抄 packages/i18n/mobile/tsconfig.json）：

```jsonc
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true
  }
}
```

`vitest.config.ts`：

```ts
import { defineProject } from "vitest/config";

export default defineProject({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    name: "analytics-mobile",
  },
});
```

- [ ] **Step 3: 写 provider 接口与 noop 实现**

`src/providers/types.ts`：

```ts
// @openstarter/analytics-mobile —— 分析 provider 统一接口。
//
// 门面（../facade）依据配置选择一个或多个 provider 实例；所有方法都必须
// 自行消化错误（分析上报永不向业务层抛错），接口约定即错误边界。

/** 事件属性：值必须可 JSON 序列化（由各 SDK 自行校验，接口层不复制约束）。 */
export type EventProperties = Record<string, unknown>;

/** 用户 traits：identify 附带的画像字段（firstName/email/plan 等）。 */
export type UserTraits = Record<string, unknown>;

export interface AnalyticsProvider {
  /** provider 标识，供消费方打日志与测试断言。 */
  readonly name: "openpanel" | "firebase" | "noop";
  /** 初始化；幂等，重复调用无副作用。 */
  init(): Promise<void>;
  track(event: string, properties?: EventProperties): Promise<void>;
  identify(profileId: string, traits?: UserTraits): Promise<void>;
  /** null 表示清除（登出场景）。 */
  setUserId(userId: string | null): Promise<void>;
  setScreenName(name: string, params?: EventProperties): Promise<void>;
}
```

`src/providers/noop.ts`：

```ts
// noop provider —— 未配置任何供应商时的空实现。
//
// 门面在「无配置」与「全部门 provider 降级失败」两种情况下返回它，
// 使消费方无需判空：拿到 provider 即可无脑调用。

import type { AnalyticsProvider, EventProperties, UserTraits } from "./types";

export function createNoopProvider(): AnalyticsProvider {
  return {
    async identify(_profileId: string, _traits?: UserTraits): Promise<void> {},
    async init(): Promise<void> {},
    name: "noop",
    async setScreenName(_name: string, _params?: EventProperties): Promise<void> {},
    async setUserId(_userId: string | null): Promise<void> {},
    async track(_event: string, _properties?: EventProperties): Promise<void> {},
  };
}
```

`src/index.ts`（门面暂只导出已存在的部分，Task 5 扩充）：

```ts
// @openstarter/analytics-mobile —— 移动端分析统一出口。
//
// 消费方（apps/mobile）只 import 本包：
//   import { initAnalytics, track, ... } from "@openstarter/analytics-mobile";
// 不直接依赖 @openpanel/react-native 或 @react-native-firebase/*。
export type {
  AnalyticsProvider,
  EventProperties,
  UserTraits,
} from "./providers/types";
export { createNoopProvider } from "./providers/noop";
```

- [ ] **Step 4: 安装依赖并验证类型**

Run: `pnpm install && pnpm --filter @openstarter/analytics-mobile check-types`
Expected: 无错误退出（peer 缺失只告警不报错）。

- [ ] **Step 5: Commit**

```bash
git add -f packages/analytics/mobile/package.json packages/analytics/mobile/tsconfig.json packages/analytics/mobile/vitest.config.ts packages/analytics/mobile/src
git commit -m "feat(analytics): scaffold @openstarter/analytics-mobile with provider interface and noop"
```

---

### Task 2: OpenPanel provider

**Files:**
- Create: `packages/analytics/mobile/src/providers/openpanel.ts`
- Test: `packages/analytics/mobile/src/providers/openpanel.test.ts`

**Interfaces:**
- Consumes: `AnalyticsProvider` / `EventProperties` / `UserTraits`（Task 1）。
- Produces: `createOpenPanelProvider(options: { clientId: string; clientSecret: string }): Promise<AnalyticsProvider>` —— 动态 import `@openpanel/react-native` 失败时返回 failed 态 provider（调用 no-op + warn 一次）；成功时包装官方 `OpenPanel` 实例。

- [ ] **Step 1: 写失败测试**

`src/providers/openpanel.test.ts`：

```ts
// OpenPanel provider 单元测试：mock @openpanel/react-native 模块，
// 验证官方 SDK 签名与 provider 接口之间的映射与降级行为。

import { beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock 会被 hoist 到文件顶部；工厂里先造可变的 mock 记录器。
const mockInstance = {
  identify: vi.fn(),
  setGlobalProperties: vi.fn(),
  track: vi.fn(),
};
vi.mock("@openpanel/react-native", () => ({
  OpenPanel: vi.fn(() => mockInstance),
}));

import { createOpenPanelProvider } from "./openpanel";

describe("createOpenPanelProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the official constructor with clientId + clientSecret", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();

    const { OpenPanel } = await import("@openpanel/react-native");
    expect(OpenPanel).toHaveBeenCalledWith({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    expect(provider.name).toBe("openpanel");
  });

  it("maps track() to instance.track with properties", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();
    await provider.track("button_clicked", { button_name: "signup" });

    expect(mockInstance.track).toHaveBeenCalledWith("button_clicked", {
      button_name: "signup",
    });
  });

  it("maps identify() to instance.identify with firstName/email hoisted and rest in properties", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();
    await provider.identify("user-1", {
      email: "a@b.c",
      firstName: "Yang",
      plan: "pro",
    });

    expect(mockInstance.identify).toHaveBeenCalledWith({
      email: "a@b.c",
      firstName: "Yang",
      profileId: "user-1",
      properties: { plan: "pro" },
    });
  });

  it("maps setUserId() to setGlobalProperties({ userId })", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();
    await provider.setUserId("user-1");

    expect(mockInstance.setGlobalProperties).toHaveBeenCalledWith({
      userId: "user-1",
    });
  });

  it("maps setScreenName() to a screen_view track event", async () => {
    const provider = await createOpenPanelProvider({
      clientId: "op-client",
      clientSecret: "op-secret",
    });
    await provider.init();
    await provider.setScreenName("/settings", { locale: "zh" });

    expect(mockInstance.track).toHaveBeenCalledWith("screen_view", {
      locale: "zh",
      screen_name: "/settings",
    });
  });

  it("degrades to failed state (no-throw) when the SDK module is missing", async () => {
    vi.resetModules();
    vi.doMock("@openpanel/react-native", () => {
      throw new Error("module not installed");
    });
    // 动态 import 失败路径：重新取被 doMock 影响的工厂
    const { createOpenPanelProvider: createWithBrokenSdk } = await import(
      "./openpanel"
    );
    const provider = await createWithBrokenSdk({
      clientId: "op-client",
      clientSecret: "op-secret",
    });

    // 不抛错；调用静默 no-op
    await expect(provider.init()).resolves.toBeUndefined();
    await expect(provider.track("e")).resolves.toBeUndefined();
    expect(provider.name).toBe("openpanel");
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @openstarter/analytics-mobile test -- src/providers/openpanel.test.ts`
Expected: FAIL（`createOpenPanelProvider` 不存在）。

- [ ] **Step 3: 写实现**

`src/providers/openpanel.ts`：

```ts
// OpenPanel provider —— 包装官方 @openpanel/react-native SDK。
//
// 动态 import 是刻意的：SDK 声明为 optional peer，未安装该依赖的 app
// 在这里被隔离（import 抛错 → failed 态 provider），门面据此跳过本
// provider，其余分析通道不受影响。
//
// 官方签名适配（消费方只见本包的 AnalyticsProvider 接口）：
//   - identify: { profileId, firstName/lastName/email... } 顶层字段官方直收，
//     其余 traits 归入 properties —— 拆分归一在本层完成。
//   - setUserId: OpenPanel 无独立概念，映射为 setGlobalProperties({ userId })。
//   - setScreenName: 官方无屏幕事件，映射为 track("screen_view", {...})。

import type {
  AnalyticsProvider,
  EventProperties,
  UserTraits,
} from "./types";

// 官方 identify 直收的顶层画像字段；其余 traits 一律进 properties。
const TOP_LEVEL_TRAIT_KEYS = ["email", "firstName", "lastName"] as const;

interface OpenPanelOptions {
  clientId: string;
  clientSecret: string;
}

/** 拆分 traits：顶层字段直传官方，其余进 properties（不可变，返回新对象）。 */
function splitTraits(traits: UserTraits | undefined): {
  properties: EventProperties;
  topLevel: EventProperties;
} {
  const topLevel: EventProperties = {};
  const properties: EventProperties = {};
  if (traits) {
    for (const [key, value] of Object.entries(traits)) {
      if ((TOP_LEVEL_TRAIT_KEYS as readonly string[]).includes(key)) {
        topLevel[key] = value;
      } else {
        properties[key] = value;
      }
    }
  }
  return { properties, topLevel };
}

/** warn 去重槽：同种错误只提示一次。 */
let hasWarned = false;
function warnOnce(message: string): void {
  if (hasWarned) {
    return;
  }
  hasWarned = true;
  console.warn(`[analytics-mobile] ${message}`);
}

export async function createOpenPanelProvider(
  options: OpenPanelOptions,
): Promise<AnalyticsProvider> {
  // 动态 import 失败（未安装 optional peer）→ failed 态 provider。
  try {
    const { OpenPanel } = await import("@openpanel/react-native");
    const instance = new OpenPanel({
      clientId: options.clientId,
      clientSecret: options.clientSecret,
    });

    return {
      async identify(profileId: string, traits?: UserTraits): Promise<void> {
        const { properties, topLevel } = splitTraits(traits);
        await instance.identify({ profileId, ...topLevel, properties });
      },
      async init(): Promise<void> {
        // 官方 RN SDK 构造即完成初始化配置；init 无额外动作。
      },
      name: "openpanel",
      async setScreenName(
        name: string,
        params?: EventProperties,
      ): Promise<void> {
        await instance.track("screen_view", { screen_name: name, ...params });
      },
      async setUserId(userId: string | null): Promise<void> {
        await instance.setGlobalProperties({ userId });
      },
      async track(event: string, properties?: EventProperties): Promise<void> {
        await instance.track(event, properties);
      },
    };
  } catch (error) {
    warnOnce(
      `OpenPanel SDK unavailable, provider skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    // failed 态：接口契约的 no-op 实现，永不抛错。
    return {
      async identify(): Promise<void> {},
      async init(): Promise<void> {},
      name: "openpanel",
      async setScreenName(): Promise<void> {},
      async setUserId(): Promise<void> {},
      async track(): Promise<void> {},
    };
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @openstarter/analytics-mobile test -- src/providers/openpanel.test.ts`
Expected: PASS（6 个用例全绿）。

- [ ] **Step 5: Commit**

```bash
git add packages/analytics/mobile/src/providers/openpanel.ts packages/analytics/mobile/src/providers/openpanel.test.ts
git commit -m "feat(analytics): add OpenPanel provider with official SDK signature mapping"
```

---

### Task 3: Firebase provider（含 GA 事件名 sanitize）

**Files:**
- Create: `packages/analytics/mobile/src/providers/firebase.ts`
- Test: `packages/analytics/mobile/src/providers/firebase.test.ts`

**Interfaces:**
- Consumes: `AnalyticsProvider` / `EventProperties` / `UserTraits`（Task 1）。
- Produces: `createFirebaseProvider(): Promise<AnalyticsProvider>` —— 动态 import `@react-native-firebase/analytics`；导出纯函数 `sanitizeGaEventName(name: string): string` 供测试直接断言。

- [ ] **Step 1: 写失败测试**

`src/providers/firebase.test.ts`：

```ts
// Firebase (GA4) provider 单元测试：mock @react-native-firebase/analytics，
// 验证 GA 事件名 sanitize 与官方 API 映射、失败降级与 warn 去重。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAnalyticsInstance = {
  logEvent: vi.fn(),
  logScreenView: vi.fn(),
  setUserProperties: vi.fn(),
  setUserId: vi.fn(),
};
vi.mock("@react-native-firebase/analytics", () => ({
  __esModule: true,
  default: vi.fn(() => mockAnalyticsInstance),
}));

import { createFirebaseProvider, sanitizeGaEventName } from "./firebase";

describe("sanitizeGaEventName", () => {
  it("keeps valid names untouched", () => {
    expect(sanitizeGaEventName("button_clicked")).toBe("button_clicked");
    expect(sanitizeGaEventName("A1_b2")).toBe("A1_b2");
  });

  it("replaces disallowed characters with underscores", () => {
    expect(sanitizeGaEventName("button-clicked")).toBe("button_clicked");
    expect(sanitizeGaEventName("user login!")).toBe("user_login_");
    expect(sanitizeGaEventName("a.b:c")).toBe("a_b_c");
  });

  it("truncates to the 40-character GA cap without dropping the event", () => {
    const long = "a".repeat(50);
    expect(sanitizeGaEventName(long)).toBe("a".repeat(40));
  });
});

describe("createFirebaseProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps track() to logEvent with params", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();
    await provider.track("login", { method: "Google" });

    expect(mockAnalyticsInstance.logEvent).toHaveBeenCalledWith("login", {
      method: "Google",
    });
    expect(provider.name).toBe("firebase");
  });

  it("sanitizes event names before logEvent", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();
    await provider.track("sign-up now");

    expect(mockAnalyticsInstance.logEvent).toHaveBeenCalledWith("sign_up_now", undefined);
  });

  it("maps identify() to setUserProperties with flattened traits", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();
    await provider.identify("user-1", { plan: "pro" });

    expect(mockAnalyticsInstance.setUserProperties).toHaveBeenCalledWith({
      plan: "pro",
    });
  });

  it("maps setUserId(null) to clearing the user id", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();

    await provider.setUserId("user-1");
    expect(mockAnalyticsInstance.setUserId).toHaveBeenLastCalledWith("user-1");

    await provider.setUserId(null);
    expect(mockAnalyticsInstance.setUserId).toHaveBeenLastCalledWith(null);
  });

  it("maps setScreenName() to logScreenView", async () => {
    const provider = await createFirebaseProvider();
    await provider.init();
    await provider.setScreenName("/profile", { tab: "credits" });

    expect(mockAnalyticsInstance.logScreenView).toHaveBeenCalledWith({
      screen_name: "/profile",
      tab: "credits",
    });
  });

  it("deduplicates warnings when calls repeatedly throw (missing plist)", async () => {
    mockAnalyticsInstance.logEvent.mockRejectedValue(
      new Error("No Firebase app config"),
    );
    const provider = await createFirebaseProvider();
    await provider.init();

    await provider.track("a");
    await provider.track("b");

    expect(console.warn).toHaveBeenCalledTimes(1);
    // 不向业务层抛错
    await expect(provider.track("c")).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @openstarter/analytics-mobile test -- src/providers/firebase.test.ts`
Expected: FAIL（`createFirebaseProvider` / `sanitizeGaEventName` 不存在）。

- [ ] **Step 3: 写实现**

`src/providers/firebase.ts`：

```ts
// Firebase (GA4) provider —— 包装 @react-native-firebase/analytics。
//
// 动态 import 是刻意的（optional peer，隔离未安装的 app）。RNFirebase
// 随模块加载自动启动、无显式 init，因此 init() 仅缓存引用、零副作用；
// 真正的运行时错误（缺 google-services.json / GoogleService-Info.plist）
// 在首次方法调用时抛出 —— provider 将其转为 failed 态：warn 一次后
// 后续调用静默 no-op，绝不向业务层抛错（fork 者没配 Firebase 但开着
// ga_mobile_enabled 时，应用其余功能不受影响）。
//
// GA 事件名约束：/^[A-Za-z0-9_]+$/ 且 ≤40 字符。违规事件名 sanitize
// 后照发（改名不丢弃），保证事件不静默消失。

import type {
  AnalyticsProvider,
  EventProperties,
  UserTraits,
} from "./types";

// GA 硬限制：事件名 ≤40 字符、仅字母数字下划线。
const GA_EVENT_NAME_MAX_LENGTH = 40;

/** GA 事件名 sanitize：非法字符替换为 `_`、超长截断（改名发，不丢弃）。 */
export function sanitizeGaEventName(name: string): string {
  const replaced = name.replace(/[^A-Za-z0-9_]/gu, "_");
  return replaced.slice(0, GA_EVENT_NAME_MAX_LENGTH);
}

/** warn 去重槽：模块级，同种错误只提示一次（整体置位，不就地修改逻辑无涉）。 */
let hasWarned = false;
function warnOnce(message: string): void {
  if (hasWarned) {
    return;
  }
  hasWarned = true;
  console.warn(`[analytics-mobile] ${message}`);
}

export async function createFirebaseProvider(): Promise<AnalyticsProvider> {
  try {
    const mod = await import("@react-native-firebase/analytics");
    // RNFirebase 默认导出是 getApp() 式的实例取值器。
    const getAnalytics = mod.default;

    return {
      async identify(
        _profileId: string,
        traits?: UserTraits,
      ): Promise<void> {
        try {
          // GA 无 identify 概念：traits 扁平化为 user properties。
          await getAnalytics().setUserProperties({ ...(traits ?? {}) });
        } catch (error) {
          warnOnce(
            `Firebase analytics unavailable (missing plist?), provider disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      async init(): Promise<void> {
        // RNFirebase 自动启动；显式初始化不存在，保持零副作用。
      },
      name: "firebase",
      async setScreenName(
        name: string,
        params?: EventProperties,
      ): Promise<void> {
        try {
          await getAnalytics().logScreenView({
            screen_name: name,
            ...params,
          });
        } catch (error) {
          warnOnce(
            `Firebase analytics unavailable (missing plist?), provider disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      async setUserId(userId: string | null): Promise<void> {
        try {
          await getAnalytics().setUserId(userId);
        } catch (error) {
          warnOnce(
            `Firebase analytics unavailable (missing plist?), provider disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
      async track(event: string, properties?: EventProperties): Promise<void> {
        try {
          await getAnalytics().logEvent(
            sanitizeGaEventName(event),
            properties,
          );
        } catch (error) {
          warnOnce(
            `Firebase analytics unavailable (missing plist?), provider disabled: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      },
    };
  } catch (error) {
    // 模块本身缺失（未装 optional peer）。
    warnOnce(
      `Firebase analytics SDK unavailable, provider skipped: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return {
      async identify(): Promise<void> {},
      async init(): Promise<void> {},
      name: "firebase",
      async setScreenName(): Promise<void> {},
      async setUserId(): Promise<void> {},
      async track(): Promise<void> {},
    };
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @openstarter/analytics-mobile test -- src/providers/firebase.test.ts`
Expected: PASS（8 个用例全绿）。

- [ ] **Step 5: Commit**

```bash
git add packages/analytics/mobile/src/providers/firebase.ts packages/analytics/mobile/src/providers/firebase.test.ts
git commit -m "feat(analytics): add Firebase GA4 provider with event-name sanitization"
```

---

### Task 4: config 解析（响应 → MobileAnalyticsConfig）

**Files:**
- Create: `packages/analytics/mobile/src/config.ts`
- Test: `packages/analytics/mobile/src/config.test.ts`

**Interfaces:**
- Consumes: 无新依赖（纯函数）。
- Produces: `MobileAnalyticsConfig`（`{ gaMobileEnabled: boolean; openpanelClientId: string; openpanelClientSecret: string }`）与 `resolveMobileAnalyticsConfig(response: Record<string, unknown> | undefined | null): MobileAnalyticsConfig`。门面（Task 5）与 apps/mobile（Task 8）依赖。

- [ ] **Step 1: 写失败测试（含 fast-check 属性测试）**

`src/config.test.ts`：

```ts
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
        gaMobileEnabled: fc.oneof(
          fc.string(),
          fc.integer(),
          fc.boolean(),
          fc.constant(null),
        ),
        openpanelClientId: fc.oneof(
          fc.string(),
          fc.integer(),
          fc.constant(null),
        ),
        openpanelClientSecret: fc.oneof(
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
          input as Record<string, unknown> | undefined | null,
        );
        expect(typeof config.gaMobileEnabled).toBe("boolean");
        expect(typeof config.openpanelClientId).toBe("string");
        expect(typeof config.openpanelClientSecret).toBe("string");
      }),
    );
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @openstarter/analytics-mobile test -- src/config.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 写实现**

`src/config.ts`：

```ts
// GET /api/analytics/config 响应 → 门面配置的解析层。
//
// 响应 shape 由服务端 PublicAnalyticsConfig 决定（见
// packages/api/src/modules/admin/analytics/service.ts），但本包不 import
// 服务端类型 —— 移动端对响应永远持不信任态度（外部数据边界）：
// 逐键校验类型、去空白，非法/缺失一律归零值。任何 shape 都不抛错。

/** 门面初始化所需的移动端分析配置（已归一）。 */
export interface MobileAnalyticsConfig {
  gaMobileEnabled: boolean;
  openpanelClientId: string;
  openpanelClientSecret: string;
}

/** 未配置任何供应商时的零值配置。 */
const DISABLED_CONFIG: MobileAnalyticsConfig = {
  gaMobileEnabled: false,
  openpanelClientId: "",
  openpanelClientSecret: "",
};

/** 读取字符串键：非 string 或缺失返回 null（0 值由调用方归一）。 */
function readStringKey(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * 解析公开分析配置响应（不信任外部 shape，永不抛错）。
 * - openpanel 两键非空才视为已配置 OP；
 * - gaMobileEnabled 严格 `=== "true"`（与服务端开关语义一致）。
 */
export function resolveMobileAnalyticsConfig(
  response: Record<string, unknown> | undefined | null,
): MobileAnalyticsConfig {
  if (!response || typeof response !== "object") {
    return DISABLED_CONFIG;
  }

  return {
    gaMobileEnabled: response.gaMobileEnabled === "true",
    openpanelClientId: readStringKey(response, "openpanelClientId") ?? "",
    openpanelClientSecret: readStringKey(response, "openpanelClientSecret") ?? "",
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @openstarter/analytics-mobile test -- src/config.test.ts`
Expected: PASS（5 个用例 + 属性测试全绿）。

- [ ] **Step 5: Commit**

```bash
git add packages/analytics/mobile/src/config.ts packages/analytics/mobile/src/config.test.ts
git commit -m "feat(analytics): add untrusting config resolver for /api/analytics/config response"
```

---

### Task 5: 门面（initAnalytics + 预 init no-op + 幂等）

**Files:**
- Create: `packages/analytics/mobile/src/facade.ts`
- Modify: `packages/analytics/mobile/src/index.ts`
- Test: `packages/analytics/mobile/src/facade.test.ts`

**Interfaces:**
- Consumes: `AnalyticsProvider`（Task 1）、`createOpenPanelProvider`（Task 2）、`createFirebaseProvider`（Task 3）、`resolveMobileAnalyticsConfig` 输出类型 `MobileAnalyticsConfig`（Task 4）。
- Produces（即包最终公开 API）：
  - `initAnalytics(config: MobileAnalyticsConfig): Promise<AnalyticsProvider>` —— 幂等，返回生效 provider。
  - 便捷转发：`track(event: string, properties?: EventProperties): Promise<void>`、`identify(profileId: string, traits?: UserTraits): Promise<void>`、`setUserId(userId: string | null): Promise<void>`、`setScreenName(name: string, params?: EventProperties): Promise<void>`。
  - `resetAnalyticsForTests(): void` —— 仅测试用，清空模块级缓存槽。

- [ ] **Step 1: 写失败测试**

`src/facade.test.ts`：

```ts
// 门面测试：provider 选择/组合/降级、预 init no-op、幂等。
// 两个 SDK 的 provider 工厂均以 vi.mock 替身注入，避免触真实模块。

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalyticsProvider } from "./providers/types";

// —— mock provider 工厂 ——
const makeFakeProvider = (name: AnalyticsProvider["name"]): AnalyticsProvider => ({
  identify: vi.fn(),
  init: vi.fn(),
  name,
  setScreenName: vi.fn(),
  setUserId: vi.fn(),
  track: vi.fn(),
});

const mockOpenPanelProvider = makeFakeProvider("openpanel");
const mockFirebaseProvider = makeFakeProvider("firebase");

vi.mock("./providers/openpanel", () => ({
  createOpenPanelProvider: vi.fn(async () => mockOpenPanelProvider),
}));
vi.mock("./providers/firebase", () => ({
  createFirebaseProvider: vi.fn(async () => mockFirebaseProvider),
}));

import {
  identify,
  initAnalytics,
  resetAnalyticsForTests,
  setScreenName,
  setUserId,
  track,
} from "./facade";
import { createOpenPanelProvider } from "./providers/openpanel";
import { createFirebaseProvider } from "./providers/firebase";

const fullConfig = {
  gaMobileEnabled: true,
  openpanelClientId: "op-client",
  openpanelClientSecret: "op-secret",
};

describe("initAnalytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAnalyticsForTests();
  });

  it("returns noop provider and creates nothing when config is empty", async () => {
    const provider = await initAnalytics({
      gaMobileEnabled: false,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });

    expect(provider.name).toBe("noop");
    expect(createOpenPanelProvider).not.toHaveBeenCalled();
    expect(createFirebaseProvider).not.toHaveBeenCalled();
  });

  it("creates only OpenPanel when only OP keys are set", async () => {
    const provider = await initAnalytics({
      gaMobileEnabled: false,
      openpanelClientId: "op-client",
      openpanelClientSecret: "op-secret",
    });

    expect(provider.name).toBe("openpanel");
    expect(createFirebaseProvider).not.toHaveBeenCalled();
  });

  it("creates only Firebase when gaMobileEnabled without OP keys", async () => {
    const provider = await initAnalytics({
      gaMobileEnabled: true,
      openpanelClientId: "",
      openpanelClientSecret: "",
    });

    expect(provider.name).toBe("firebase");
    expect(createOpenPanelProvider).not.toHaveBeenCalled();
  });

  it("composes both providers when both are configured", async () => {
    const provider = await initAnalytics(fullConfig);

    expect(createOpenPanelProvider).toHaveBeenCalledTimes(1);
    expect(createFirebaseProvider).toHaveBeenCalledTimes(1);
    // composite 转发：一次 track 双写
    await provider.track("e");
    expect(mockOpenPanelProvider.track).toHaveBeenCalledWith("e", undefined);
    expect(mockFirebaseProvider.track).toHaveBeenCalledWith("e", undefined);
  });

  it("skips a provider whose factory throws and warns once", async () => {
    vi.mocked(createOpenPanelProvider).mockRejectedValueOnce(
      new Error("boom"),
    );
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const provider = await initAnalytics(fullConfig);

    expect(provider.name).toBe("firebase");
    expect(console.warn).toHaveBeenCalledTimes(1);
    vi.restoreAllMocks();
  });

  it("is idempotent: second init returns the same instance without re-creating", async () => {
    const first = await initAnalytics(fullConfig);
    const second = await initAnalytics(fullConfig);

    expect(second).toBe(first);
    expect(createOpenPanelProvider).toHaveBeenCalledTimes(1);
    expect(createFirebaseProvider).toHaveBeenCalledTimes(1);
  });

  it("convenience forwarders are safe no-ops before init", async () => {
    await expect(track("e")).resolves.toBeUndefined();
    await expect(identify("u")).resolves.toBeUndefined();
    await expect(setUserId("u")).resolves.toBeUndefined();
    await expect(setScreenName("/")).resolves.toBeUndefined();
    // 未 init：任何工厂都不该被创建
    expect(createOpenPanelProvider).not.toHaveBeenCalled();
    expect(createFirebaseProvider).not.toHaveBeenCalled();
  });

  it("convenience forwarders reach the active provider after init", async () => {
    await initAnalytics(fullConfig);

    await track("event", { a: 1 });
    await identify("user-1", { plan: "pro" });
    await setUserId("user-1");
    await setScreenName("/home");

    expect(mockOpenPanelProvider.track).toHaveBeenCalledWith("event", { a: 1 });
    expect(mockOpenPanelProvider.identify).toHaveBeenCalledWith("user-1", {
      plan: "pro",
    });
    expect(mockOpenPanelProvider.setUserId).toHaveBeenCalledWith("user-1");
    expect(mockOpenPanelProvider.setScreenName).toHaveBeenCalledWith("/home", undefined);
    // composite 双写同步落到 firebase
    expect(mockFirebaseProvider.track).toHaveBeenCalledWith("event", { a: 1 });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @openstarter/analytics-mobile test -- src/facade.test.ts`
Expected: FAIL（`./facade` 不存在）。

- [ ] **Step 3: 写门面实现**

`src/facade.ts`：

```ts
// 门面 —— initAnalytics 按配置组装 provider，便捷函数转发事件。
//
// 语义（spec §4）：
//   - 未配置 → noop；单开 → 单 provider；双开 → composite（事件双写）。
//   - provider 工厂抛错 → warn 一次后跳过该 provider，不影响其余。
//   - init 幂等：模块级缓存槽整体替换（不就地修改），二次调用直返。
//   - 预 init 调用便捷函数是安全 no-op（移动端启动流程 init 必然先行，
//     不引入队列复杂度）。
//   - 门面所有方法自身 try/catch：分析上报永不向业务层抛错。

import type { MobileAnalyticsConfig } from "./config";
import { createFirebaseProvider } from "./providers/firebase";
import { createNoopProvider } from "./providers/noop";
import { createOpenPanelProvider } from "./providers/openpanel";
import type {
  AnalyticsProvider,
  EventProperties,
  UserTraits,
} from "./providers/types";

// 模块级缓存槽（单例；仅整体替换，不就地修改——对齐 analytics-web 的 configCache 模式）。
let activeProvider: AnalyticsProvider | undefined;

/** composite provider：把同一次调用遍历转发给全部子 provider。 */
function compositeProvider(providers: AnalyticsProvider[]): AnalyticsProvider {
  const forward = async (
    action: (provider: AnalyticsProvider) => Promise<void>,
  ): Promise<void> => {
    for (const provider of providers) {
      await action(provider);
    }
  };

  return {
    identify: (profileId, traits) =>
      forward((p) => p.identify(profileId, traits)),
    init: () => forward((p) => p.init()),
    name: "noop", // composite 无独立标识；对外沿用 noop（仅供日志，不影响行为）
    setScreenName: (name, params) =>
      forward((p) => p.setScreenName(name, params)),
    setUserId: (userId) => forward((p) => p.setUserId(userId)),
    track: (event, properties) => forward((p) => p.track(event, properties)),
  };
}

/** warn 去重：门面层每个工厂失败只提示一次。 */
const warnedFactories = new Set<string>();
function warnFactoryOnce(key: string, error: unknown): void {
  if (warnedFactories.has(key)) {
    return;
  }
  warnedFactories.add(key);
  console.warn(
    `[analytics-mobile] ${key} provider init failed, skipped: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}

/**
 * 按配置初始化并返回生效 provider（幂等）。
 * OP：clientId 与 clientSecret 都非空才启用（半配置视为未配置）。
 * GA：gaMobileEnabled 才实例化（firebase 构建文件缺失由 provider 内部降级）。
 */
export async function initAnalytics(
  config: MobileAnalyticsConfig,
): Promise<AnalyticsProvider> {
  if (activeProvider) {
    return activeProvider;
  }

  const providers: AnalyticsProvider[] = [];

  if (config.openpanelClientId && config.openpanelClientSecret) {
    try {
      providers.push(
        await createOpenPanelProvider({
          clientId: config.openpanelClientId,
          clientSecret: config.openpanelClientSecret,
        }),
      );
    } catch (error) {
      warnFactoryOnce("openpanel", error);
    }
  }

  if (config.gaMobileEnabled) {
    try {
      providers.push(await createFirebaseProvider());
    } catch (error) {
      warnFactoryOnce("firebase", error);
    }
  }

  activeProvider =
    providers.length === 0
      ? createNoopProvider()
      : providers.length === 1
        ? providers[0]
        : compositeProvider(providers);

  return activeProvider;
}

/** 仅测试用：清空模块级缓存槽与 warn 去重集合。 */
export function resetAnalyticsForTests(): void {
  activeProvider = undefined;
  warnedFactories.clear();
}

// —— 便捷转发（预 init 是安全 no-op） ——

export async function track(
  event: string,
  properties?: EventProperties,
): Promise<void> {
  try {
    await activeProvider?.track(event, properties);
  } catch {
    // 上报永不抛错
  }
}

export async function identify(
  profileId: string,
  traits?: UserTraits,
): Promise<void> {
  try {
    await activeProvider?.identify(profileId, traits);
  } catch {
    // 上报永不抛错
  }
}

export async function setUserId(userId: string | null): Promise<void> {
  try {
    await activeProvider?.setUserId(userId);
  } catch {
    // 上报永不抛错
  }
}

export async function setScreenName(
  name: string,
  params?: EventProperties,
): Promise<void> {
  try {
    await activeProvider?.setScreenName(name, params);
  } catch {
    // 上报永不抛错
  }
}
```

更新 `src/index.ts`（完整版）：

```ts
// @openstarter/analytics-mobile —— 移动端分析统一出口。
//
// 消费方（apps/mobile）只 import 本包：
//   import { initAnalytics, track, ... } from "@openstarter/analytics-mobile";
// 不直接依赖 @openpanel/react-native 或 @react-native-firebase/*。
export { resolveMobileAnalyticsConfig } from "./config";
export type { MobileAnalyticsConfig } from "./config";
export {
  identify,
  initAnalytics,
  resetAnalyticsForTests,
  setScreenName,
  setUserId,
  track,
} from "./facade";
export { createNoopProvider } from "./providers/noop";
export { sanitizeGaEventName } from "./providers/firebase";
export { createOpenPanelProvider } from "./providers/openpanel";
export { createFirebaseProvider } from "./providers/firebase";
export type {
  AnalyticsProvider,
  EventProperties,
  UserTraits,
} from "./providers/types";
```

- [ ] **Step 4: 跑测试确认通过 + 类型检查**

Run: `pnpm --filter @openstarter/analytics-mobile test && pnpm --filter @openstarter/analytics-mobile check-types`
Expected: 全部 PASS；类型检查无错。

- [ ] **Step 5: Commit**

```bash
git add packages/analytics/mobile/src/facade.ts packages/analytics/mobile/src/facade.test.ts packages/analytics/mobile/src/index.ts
git commit -m "feat(analytics): add facade with provider composition, idempotent init and pre-init no-op"
```

---

### Task 6: 配置数据面（shared 三键 + API 扩展响应）

**Files:**
- Modify: `packages/shared/src/config.ts`（groups 数组 + settings 数组两处）
- Modify: `packages/api/src/modules/admin/analytics/service.ts:39-43`（接口）、`91-98`（实现）
- Test: `packages/shared/src/config.property.test.ts`（追加分组断言）
- Test: Create `packages/api/src/modules/admin/analytics/service.test.ts`

**Interfaces:**
- Consumes: 无。
- Produces: `getPublicAnalyticsConfig()` 返回的 `PublicAnalyticsConfig` 新增三字段：`openpanelClientId: string`、`openpanelClientSecret: string`、`gaMobileEnabled: boolean`（Task 8 的 apps/mobile 消费、`/api/analytics/config` 响应自动获得）。

- [ ] **Step 1: 写失败测试（API 侧）**

`packages/api/src/modules/admin/analytics/service.test.ts`：

```ts
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @openstarter/api test -- src/modules/admin/analytics/service.test.ts`
Expected: FAIL（响应缺 `openpanelClientId` 等新键）。

- [ ] **Step 3: shared 配置键 + 分组**

`packages/shared/src/config.ts` 的 `getSettingGroups()` 中，在 `plausible` 分组之后插入：

```ts
    {
      description:
        "OpenPanel product analytics. The RN SDK officially requires the clientSecret in the client; rotate it in the OpenPanel dashboard anytime",
      name: "openpanel",
      tab: "analytics",
      title: "OpenPanel",
    },
```

`getSettings()` 中，在 `plausible_src` 项之后插入三个键：

```ts
    // Analytics / OpenPanel（移动端）
    {
      group: "openpanel",
      name: "openpanel_client_id",
      placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      tab: "analytics",
      tip: "Client ID from your OpenPanel dashboard",
      title: "Client ID",
      type: "text",
    },
    {
      group: "openpanel",
      name: "openpanel_client_secret",
      placeholder: "xxxxxxxx",
      tab: "analytics",
      tip: "Required by the official RN SDK; rotate in the OpenPanel dashboard",
      title: "Client Secret",
      type: "password",
    },
    {
      group: "google_analytics",
      name: "ga_mobile_enabled",
      tab: "analytics",
      title: "Enable Mobile (Firebase)",
      type: "switch",
    },
```

在 `packages/shared/src/config.property.test.ts` 末尾追加一个 describe（分组白名单回归）。该文件现有 import 仅含 `isMaskedConfigValue, isSecretConfigKey, maskConfigValue, PROTECTED_CONFIG_KEYS`（`./config`），需扩充为：

```ts
import {
  getSettingGroups,
  isMaskedConfigValue,
  isSecretConfigKey,
  maskConfigValue,
  PROTECTED_CONFIG_KEYS,
} from "./config";
```

追加用例：

```ts
describe("getSettingGroups — mobile analytics groups", () => {
  it("exposes the openpanel group on the analytics tab", () => {
    const groups = getSettingGroups();
    const openpanel = groups.find((g) => g.name === "openpanel");
    expect(openpanel?.tab).toBe("analytics");
    expect(openpanel?.title).toBe("OpenPanel");
  });

  it("keeps google_analytics group on the analytics tab (hosts ga_mobile_enabled)", () => {
    const groups = getSettingGroups();
    const ga = groups.find((g) => g.name === "google_analytics");
    expect(ga?.tab).toBe("analytics");
  });
});
```

- [ ] **Step 4: API 侧扩展 PublicAnalyticsConfig**

`packages/api/src/modules/admin/analytics/service.ts`：

接口（替换现有 `PublicAnalyticsConfig`）：

```ts
/**
 * 公开分析配置（R25.1/R25.2 数据面 + 移动端扩展）：仅含分析供应商标识与
 * 度量 ID（非敏感）。空字符串表示未配置该供应商——apps/web 据此决定是否注入
 * 对应脚本，apps/mobile 据此决定是否初始化对应 SDK。
 *
 * 移动端三键的设计决策（spec §6）：openpanel_client_secret 经公开端点下发是
 * **有意的** —— 官方 RN SDK 即要求 clientSecret 进客户端（认证用），暴露面与
 * 打进 app bundle 等价；该 secret 可在 OpenPanel 面板随时轮换。
 */
export interface PublicAnalyticsConfig {
  gaMobileEnabled: boolean;
  googleAnalyticsId: string;
  openpanelClientId: string;
  openpanelClientSecret: string;
  plausibleDomain: string;
  plausibleSrc: string;
}
```

实现（替换现有 `getPublicAnalyticsConfig`）：

```ts
/**
 * 读取公开分析配置：从 Config 取分析供应商标识与度量 ID，去空白后返回；
 * 未配置项为空字符串。**绝不**下发其它（含敏感）配置项——仅白名单内的分析键。
 * `ga_mobile_enabled` 严格 `=== "true"`（与开关语义一致），映射为 boolean。
 */
export async function getPublicAnalyticsConfig(): Promise<PublicAnalyticsConfig> {
  const configs = await getAllConfigs();
  return {
    gaMobileEnabled: configs.ga_mobile_enabled === "true",
    googleAnalyticsId: configs.google_analytics_id?.trim() ?? "",
    openpanelClientId: configs.openpanel_client_id?.trim() ?? "",
    openpanelClientSecret: configs.openpanel_client_secret?.trim() ?? "",
    plausibleDomain: configs.plausible_domain?.trim() ?? "",
    plausibleSrc: configs.plausible_src?.trim() ?? "",
  };
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter @openstarter/api test -- src/modules/admin/analytics/service.test.ts && pnpm --filter @openstarter/shared test`
Expected: 新测试 PASS；shared 全绿（无回归）。

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/config.ts packages/shared/src/config.property.test.ts packages/api/src/modules/admin/analytics/service.ts packages/api/src/modules/admin/analytics/service.test.ts
git commit -m "feat(api): expose openpanel keys and ga_mobile_enabled via public analytics config"
```

---

### Task 7: Firebase 构建文件（example 模板 + gitignore + config plugin）

**Files:**
- Create: `apps/mobile/google-services.json.example`
- Create: `apps/mobile/GoogleService-Info.plist.example`
- Create: `apps/mobile/plugins/with-firebase-config.js`
- Modify: `apps/mobile/.gitignore`（追加两行）
- Modify: `apps/mobile/app.config.ts:23`（plugins 数组）

**Interfaces:**
- Consumes: 无（构建期文件，运行时无交互）。
- Produces: `expo prebuild` 时自动接线 Firebase（Android gradle 插件 + iOS plist 复制 build phase）；无配置文件时 plugin no-op + console 提示。

- [ ] **Step 1: 写两个 example 模板**

`apps/mobile/google-services.json.example`（JSONC 注释仅在文件头说明，实际 JSON 无注释——用 `_comment` 键保持合法 JSON）：

```json
{
  "_comment": "Copy this file to apps/mobile/google-services.json and fill in values from the Firebase console (Project settings > General > Your apps > Android app). See docs in this repo.",
  "_fields": {
    "client": [{ "client_info": { "android_client_info": { "package_name": "dev.openstarter.app" } } }],
    "project_info": { "project_id": "your-firebase-project", "project_number": "000000000000" }
  },
  "client": [
    {
      "client_info": {
        "android_client_info": { "package_name": "dev.openstarter.app" },
        "mobilesdk_app_id": "1:000000000000:android:0000000000000000000000"
      },
      "api_key": [{ "current_key": "YOUR_ANDROID_API_KEY" }],
      "oauth_client": []
    }
  ],
  "configuration_version": "1",
  "project_info": {
    "project_id": "your-firebase-project",
    "project_number": "000000000000",
    "storage_bucket": "your-firebase-project.appspot.com"
  }
}
```

`apps/mobile/GoogleService-Info.plist.example`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!-- Copy this file to apps/mobile/GoogleService-Info.plist and fill in values
     from the Firebase console (Project settings > General > Your apps > iOS app). -->
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>BUNDLE_ID</key>
	<string>dev.openstarter.app</string>
	<key>GOOGLE_APP_ID</key>
	<string>1:000000000000:ios:0000000000000000000000</string>
	<key>PROJECT_ID</key>
	<string>your-firebase-project</string>
	<key>API_KEY</key>
	<string>YOUR_IOS_API_KEY</string>
	<key>GCM_SENDER_ID</key>
	<string>000000000000</string>
	<key>STORAGE_BUCKET</key>
	<string>your-firebase-project.appspot.com</string>
	<key>IS_ADS_ENABLED</key>
	<false></false>
	<key>IS_ANALYTICS_ENABLED</key>
	<true></true>
</dict>
</plist>
```

- [ ] **Step 2: 更新 .gitignore**

`apps/mobile/.gitignore` 在 `# Environment & local files` 区块追加：

```gitignore
# Firebase 原生配置：fork 者各自的项目凭据，不入库（模板见 *.example）
google-services.json
GoogleService-Info.plist
```

- [ ] **Step 3: 写本地 config plugin**

`apps/mobile/plugins/with-firebase-config.js`：

```js
// with-firebase-config —— Expo config plugin：prebuild 时接线 Firebase 原生工程。
//
// Android：应用 com.google.gms.google-services gradle 插件（读取 android/app/google-services.json）。
// iOS：注入一个复制 GoogleService-Info.plist 进 app bundle 的 build phase。
//
// 配置文件不存在时整个 plugin no-op（console 提示一次）——未使用 Firebase 的
// fork 者 prebuild 行为与从前完全一致。文件存在性在 plugin 内部检测（而非
// app.config.ts 里条件注册），保证 app.config.ts 恒定、无分支。

const fs = require("node:fs");
const path = require("node:path");

const ANDROID_CONFIG = "google-services.json";
const IOS_CONFIG = "GoogleService-Info.plist";

const withFirebaseConfig = (config) => {
  const projectRoot = __dirname;
  const androidConfigPath = path.join(projectRoot, "..", ANDROID_CONFIG);
  const iosConfigPath = path.join(projectRoot, "..", IOS_CONFIG);

  const hasAndroid = fs.existsSync(androidConfigPath);
  const hasIos = fs.existsSync(iosConfigPath);

  if (!hasAndroid && !hasIos) {
    console.warn(
      `[with-firebase-config] Neither ${ANDROID_CONFIG} nor ${IOS_CONFIG} found in apps/mobile — skipping Firebase wiring. ` +
        "Copy the *.example templates and fill in your Firebase project values to enable GA mobile.",
    );
    return config;
  }

  // Android：加 gradle 插件依赖 + apply
  const withAndroidGoogleServices = (innerConfig) => ({
    ...innerConfig,
    android: {
      ...innerConfig.android,
      ...(hasAndroid
        ? {}
        : {}),
    },
  });

  // 用 expo 的通用 mod 挂 gradle 修改；iOS 用dangerous mod 加 build phase。
  const withGradle = require("@expo/config-plugins").withGradleProperties;
  const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");

  let nextConfig = config;

  if (hasAndroid) {
    // app/build.gradle 需要：classpath 声明（project 级）与 apply plugin（app 级）。
    // expo prebuild 模板已含 google-services classpath 的场景由插件幂等处理。
    const { withAppBuildGradle, withProjectBuildGradle } = require("@expo/config-plugins");

    nextConfig = withProjectBuildGradle(nextConfig, (gradleConfig) => {
      if (gradleConfig.modResults.contents.includes("com.google.gms.google-services")) {
        return gradleConfig;
      }
      gradleConfig.modResults.contents = gradleConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        "dependencies {\n        classpath 'com.google.gms:google-services:4.4.2'",
      );
      return gradleConfig;
    });

    nextConfig = withAppBuildGradle(nextConfig, (gradleConfig) => {
      if (gradleConfig.modResults.contents.includes("com.google.gms.google-services")) {
        return gradleConfig;
      }
      gradleConfig.modResults.contents = `${
        gradleConfig.modResults.contents
      }\napply plugin: 'com.google.gms.google-services'`;
      return gradleConfig;
    });
  }

  if (hasIos) {
    nextConfig = withXcodeProject(nextConfig, (xcodeConfig) => {
      const xcProject = xcodeConfig.modResults;
      // 幂等：已存在同名 build phase 就跳过
      const hasPhase = xcProject.hash.project.objects.PBXShellScriptBuildPhase
        ? Object.values(xcProject.hash.project.objects.PBXShellScriptBuildPhase).some(
            (phase) => phase && phase.name === "[Expo] Copy GoogleService-Info.plist",
          )
        : false;
      if (!hasPhase) {
        xcProject.addBuildPhase(
          [],
          "PBXShellScriptBuildPhase",
          "[Expo] Copy GoogleService-Info.plist",
          null,
          {
            inputPaths: ['"$(SRCROOT)/GoogleService-Info.plist"'],
            outputPath: '"$(BUILT_PRODUCTS_DIR)/$(UNLOCALIZED_RESOURCES_FOLDER_PATH)/GoogleService-Info.plist"',
            shellScript:
              'cp -f "${PROJECT_DIR}/../GoogleService-Info.plist" "${BUILT_PRODUCTS_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/GoogleService-Info.plist"\n',
          },
        );
      }
      return xcodeConfig;
    });
  }

  void withAndroidGoogleServices;
  void withGradle;

  return nextConfig;
};

module.exports = withFirebaseConfig;
```

注意：`withAndroidGoogleServices`/`withGradle` 两个中间变量是无用草稿（写 plan 时的痕迹），实现时**删除**，只保留 `withProjectBuildGradle`/`withAppBuildGradle`/`withXcodeProject` 三条真实路径。最终文件应约为 80 行。

- [ ] **Step 4: 注册 plugin**

`apps/mobile/app.config.ts:23`：

```ts
  plugins: ["expo-router", "expo-secure-store", "expo-iap", "./plugins/with-firebase-config"],
```

（`plugins` 注释同步补一句：with-firebase-config 在两个 Firebase 配置文件都缺失时 no-op。）

- [ ] **Step 5: 验证**

Run: `pnpm --filter mobile check-types && node -e "const p = require('./apps/mobile/plugins/with-firebase-config.js'); const cfg = p({ name: 'x', slug: 'x' }); console.log('plugin runs:', !!cfg)"`
Expected: 类型检查通过；plugin 在无配置文件时打印 skip 提示并原样返回 config。

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/google-services.json.example apps/mobile/GoogleService-Info.plist.example apps/mobile/plugins/with-firebase-config.js apps/mobile/.gitignore apps/mobile/app.config.ts
git commit -m "feat(mobile): add Firebase config templates, gitignore and with-firebase-config plugin"
```

---

### Task 8: apps/mobile 接入（依赖 + lib 薄壳 + layout 接线）

**Files:**
- Modify: `apps/mobile/package.json`（dependencies）
- Create: `apps/mobile/src/lib/analytics.ts`
- Test: `apps/mobile/src/lib/analytics.test.ts`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/app/(tabs)/_layout.tsx`
- Modify: `apps/mobile/src/app/(auth)/_layout.tsx`

**Interfaces:**
- Consumes: `initAnalytics` / `track` / `identify` / `setUserId` / `setScreenName`、`MobileAnalyticsConfig`（Task 5）；`PublicAnalyticsConfig` 新三键（Task 6）；`apiClient.api.analytics.config.$get()`（既有 RPC）。
- Produces: `resolveMobileAnalyticsConfig(response: Record<string, unknown> | undefined | null): MobileAnalyticsConfig`（转发包内同名函数，测试锚点）、`useScreenTracking(): void` hook。
- Setup: mobile 无 `@testing-library/react`，hook 测试不渲染组件 —— 改用直接调用验证（React hooks 不可在组件外调用，故 hook 测试聚焦可提取的纯路径；`useScreenTracking` 本体 6 行、转发语义由包内门面测试覆盖，本任务只验证模块导出与 resolve 语义）。

- [ ] **Step 1: 安装依赖**

```bash
pnpm --filter mobile add @openstarter/analytics-mobile@workspace:*
pnpm --filter mobile add @openpanel/react-native@1.4.1
pnpm --filter mobile add @react-native-firebase/app@26.3.2 @react-native-firebase/analytics@26.3.2
npx expo install expo-application --cwd apps/mobile
```

注意：`expo-application` 用 `npx expo install` 保证版本与 Expo 57 SDK 匹配（落在 `5 - 7` peer 区间）。若 `npx expo install` 因缺 dev client 报错，改为 `pnpm --filter mobile add expo-application@~57.0.2`。

- [ ] **Step 2: 写失败测试（lib 薄壳）**

`apps/mobile/src/lib/analytics.test.ts`：

```ts
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
```

- [ ] **Step 3: 跑测试确认失败**

Run: `pnpm --filter mobile test -- src/lib/analytics.test.ts`
Expected: FAIL（`./analytics` 不存在）。

- [ ] **Step 4: 写 lib 薄壳**

`apps/mobile/src/lib/analytics.ts`：

```ts
// apps/mobile/src/lib/analytics.ts —— 分析能力薄壳。
//
// 真正的门面在 @openstarter/analytics-mobile（initAnalytics 选择
// OpenPanel / Firebase / noop），本文件只做两件 app 侧的事：
//   1. 把 /api/analytics/config 的 RPC 响应交给包内解析器归一；
//   2. 提供 useScreenTracking hook（expo-router 路径 → 屏幕事件）。
// 上报错误全部由门面消化；这里不再包一层 try/catch（init 的 fetch 除外
// —— 网络失败等价于「未配置分析」，静默跳过即可）。

import {
  initAnalytics,
  resolveMobileAnalyticsConfig as resolveConfig,
  setScreenName,
  type MobileAnalyticsConfig,
} from "@openstarter/analytics-mobile";
import { usePathname } from "expo-router";
import { useEffect } from "react";

import { apiClient } from "./api";

export function resolveMobileAnalyticsConfig(
  response: Record<string, unknown> | undefined | null,
): MobileAnalyticsConfig {
  return resolveConfig(response);
}

/** 拉取分析配置并初始化门面；失败等价于未配置（静默跳过）。 */
export async function initAnalyticsFromApi(): Promise<void> {
  try {
    const res = await apiClient.api.analytics.config.$get();
    if (!res.ok) {
      return;
    }
    const json = await res.json();
    await initAnalytics(resolveConfig(json.data));
  } catch {
    // 配置拉取失败 = 没有分析（与 analytics-web 的 SSR 降级同哲学）
  }
}

/** 路径变化时上报屏幕事件（tabs / auth 两个 layout 各接一行）。 */
export function useScreenTracking(): void {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname) {
      void setScreenName(pathname);
    }
  }, [pathname]);
}
```

- [ ] **Step 5: _layout.tsx 接 init**

`apps/mobile/src/app/_layout.tsx`，在 `useThemePreference(); useAppLocale();` 之后加：

```ts
  // 分析初始化：配置拉取失败等价于未配置，静默跳过（fire-and-forget）。
  useEffect(() => {
    void initAnalyticsFromApi();
  }, []);
```

顶部 import 补：

```ts
import { useEffect } from "react";

import { initAnalyticsFromApi } from "@/lib/analytics";
```

（`useEffect` 若已 import 则不重复；现有 `import { useState } from "react"` 改为同时引入 `useEffect`。）

- [ ] **Step 6: 两个子 layout 接屏幕追踪**

`apps/mobile/src/app/(tabs)/_layout.tsx` 与 `apps/mobile/src/app/(auth)/_layout.tsx` 各自组件体内加一行：

```ts
  useScreenTracking();
```

顶部 import 补 `import { useScreenTracking } from "@/lib/analytics";`。

- [ ] **Step 7: 跑测试与类型检查**

Run: `pnpm --filter mobile test -- src/lib/analytics.test.ts && pnpm --filter mobile check-types`
Expected: 测试 PASS；类型检查通过（`@openstarter/api` 的 AppType 此时已含新端点字段——Task 6 已落地）。

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml apps/mobile/src/lib/analytics.ts apps/mobile/src/lib/analytics.test.ts apps/mobile/src/app/_layout.tsx "apps/mobile/src/app/(tabs)/_layout.tsx" "apps/mobile/src/app/(auth)/_layout.tsx"
git commit -m "feat(mobile): wire analytics init and screen tracking via @openstarter/analytics-mobile"
```

---

### Task 9: CLAUDE.md 同步 + 全量验证

**Files:**
- Modify: `CLAUDE.md`（Monorepo Structure 的 analytics 行）

**Interfaces:**
- Consumes: Task 1-8 全部落地。
- Produces: 文档与现实一致；全仓测试/类型检查绿。

- [ ] **Step 1: 更新 CLAUDE.md**

`CLAUDE.md` Monorepo Structure 中：

```
│   ├── analytics/         # Event tracking (web, mobile, extension variants)
```

改为：

```
│   ├── analytics/         # Event tracking (web + mobile 变体；mobile 为单包双适配器: OpenPanel + GA4 Firebase)
```

- [ ] **Step 2: 全量验证**

Run: `pnpm --filter @openstarter/analytics-mobile test --coverage && pnpm test && pnpm check-types && pnpm lint`
Expected:
- analytics-mobile 覆盖率 ≥80%；
- 全仓 vitest 无失败（特别注意 `@openstarter/shared` 与 `@openstarter/api` 的既有用例无回归）；
- `check-types` 通过（mobile 的 AppType 引用了新响应字段，需 web/api/mobile 三方一致）;
- oxlint 无新增告警。

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: note analytics mobile variant in CLAUDE.md structure"
```
