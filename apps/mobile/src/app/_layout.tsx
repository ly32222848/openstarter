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
import { BillingProvider } from "@/lib/use-billing";
import { useAppLocale } from "@/lib/i18n";
import { useThemePreference } from "@/lib/theme";

export default function RootLayout() {
  // QueryClient 必须在渲染之间保持同一实例，否则每次重渲染都会丢掉全部缓存。
  const [queryClient] = useState(() => new QueryClient());
  const env = getEnv();

  // 两个钩子必须无条件调用（React hooks 规则），因此放在 env 分支之前。
  useThemePreference();
  const { locale } = useAppLocale();

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
        {/* 支付策略 Provider：configure 随挂载完成；供应商由构建期 env 决定。
            须在 QueryClientProvider 之内（生命周期钩子依赖 query context）。 */}
        <BillingProvider locale={locale}>
          <Stack screenOptions={{ headerShown: false }} />
          {/* PortalHost 是 overlay 类组件（Dialog/DropdownMenu/Tooltip 等）的
              渲染宿主，须作为 providers 的最后一个子节点（react-native-reusables 约定）。 */}
          <PortalHost />
        </BillingProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
