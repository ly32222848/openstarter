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
import type { AnalyticsProvider, EventProperties, UserTraits } from "./providers/types";

// 模块级缓存槽（单例；仅整体替换，不就地修改——对齐 analytics-web 的 configCache 模式）。
let activeProvider: AnalyticsProvider | undefined;

/** composite provider：把同一次调用遍历转发给全部子 provider。 */
function compositeProvider(providers: AnalyticsProvider[]): AnalyticsProvider {
  const forward = async (action: (provider: AnalyticsProvider) => Promise<void>): Promise<void> => {
    for (const provider of providers) {
      await action(provider);
    }
  };

  return {
    identify: (profileId, traits) => forward((p) => p.identify(profileId, traits)),
    init: () => forward((p) => p.init()),
    name: "noop", // composite 无独立标识；对外沿用 noop（仅供日志，不影响行为）
    setScreenName: (name, params) => forward((p) => p.setScreenName(name, params)),
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
export async function initAnalytics(config: MobileAnalyticsConfig): Promise<AnalyticsProvider> {
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

  // 解构而非下标取值：noUncheckedIndexedAccess 下 providers[0] 带宽泛 undefined，
  // 解构 + 显式判断可让 TS 精确收窄（等效于 brief 的三段 ternary）。
  const [firstProvider] = providers;
  activeProvider =
    firstProvider === undefined
      ? createNoopProvider()
      : providers.length === 1
        ? firstProvider
        : compositeProvider(providers);

  return activeProvider;
}

/** 仅测试用：清空模块级缓存槽与 warn 去重集合。 */
export function resetAnalyticsForTests(): void {
  activeProvider = undefined;
  warnedFactories.clear();
}

// —— 便捷转发（预 init 是安全 no-op） ——

export async function track(event: string, properties?: EventProperties): Promise<void> {
  try {
    await activeProvider?.track(event, properties);
  } catch {
    // 上报永不抛错
  }
}

export async function identify(profileId: string, traits?: UserTraits): Promise<void> {
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

export async function setScreenName(name: string, params?: EventProperties): Promise<void> {
  try {
    await activeProvider?.setScreenName(name, params);
  } catch {
    // 上报永不抛错
  }
}
