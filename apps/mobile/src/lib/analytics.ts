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
