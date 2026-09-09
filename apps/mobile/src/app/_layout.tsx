import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PortalHost } from "@openstarter/ui-mobile";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import "../../global.css";

import { ConfigError } from "@/components/config-error";
import { getEnv } from "@/lib/env";
import { initAnalyticsFromEnv } from "@/lib/analytics";
import { useAppLocale } from "@/lib/i18n";
import { useThemePreference } from "@/lib/theme";
import { useRevenueCatLifecycle } from "@/lib/use-revenuecat";

export default function RootLayout() {
  // QueryClient 必须在渲染之间保持同一实例，否则每次重渲染都会丢掉全部缓存。
  const [queryClient] = useState(() => new QueryClient());
  const env = getEnv();

  // 两个钩子必须无条件调用（React hooks 规则），因此放在 env 分支之前。
  useThemePreference();
  useAppLocale();
  // RevenueCat 生命周期（configure/identify/customerInfo 监听）。
  // 钩子内部全部降级安全：IAP 不可用时为 no-op，env 错误分支下也无副作用。
  useRevenueCatLifecycle();

  // 分析初始化：供应商由构建期 env（EXPO_PUBLIC_ANALYTICS_*）决定，随包固化；
  // 解析层永不抛错，未配置等价于 noop（fire-and-forget）。
  useEffect(() => {
    void initAnalyticsFromEnv();
  }, []);

  if (!env.ok) {
    return (
      <SafeAreaProvider>
        <ConfigError reason={env.reason} />
      </SafeAreaProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
        {/* PortalHost 是 overlay 类组件（Dialog/DropdownMenu/Tooltip 等）的
            渲染宿主，须作为 providers 的最后一个子节点（react-native-reusables 约定）。 */}
        <PortalHost />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
