// apps/mobile/src/lib/use-billing.tsx —— 策略层接线（替代 use-revenuecat.ts + purchases.ts）。
//
// BillingProvider = 策略 Provider（挂载即 configure，供应商由构建期 env 决定）
//                 + BillingLifecycle（会话联动 identify/reset + 客户信息推送失效缓存）。
// 必须置于 QueryClientProvider 之内（useCustomer/useQueryClient 依赖 context）。
// 生命周期钩子全部降级安全：IAP 不可用时为 no-op，永不抛错。
import { Provider as StrategyProvider, useCustomer } from "@openstarter/billing-mobile";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { authClient } from "./auth-client";

/** 客户信息变化需要刷新的查询缓存（账单三屏 + 方案徽章）。 */
const BILLING_QUERY_KEYS: ReadonlySet<string> = new Set([
  "user-plan",
  "user-subscription",
  "user-credits",
  "user-orders",
]);

/** 按 queryKey 首段失效账单查询（["user-orders", page] 这类带参键一并命中）。 */
function invalidateBillingQueries(queryClient: ReturnType<typeof useQueryClient>): void {
  for (const key of BILLING_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

/**
 * 会话联动决策（spec §4.1）：isPending 期间不动（避免把读会话中间态当成登出），
 * 有 userId → identify，否则 → reset。纯函数便于单测；BillingLifecycle 内消费。
 */
export function resolveLifecycleAction(input: {
  isPending: boolean;
  userId?: string | null;
}): "identify" | "reset" | null {
  if (input.isPending) {
    return null;
  }
  return input.userId ? "identify" : "reset";
}

function BillingLifecycle() {
  const { identify, reset, addCustomerInfoListener } = useCustomer();
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id;

  // 会话变化：登录 → identify(userId)；登出 → reset()。
  useEffect(() => {
    const action = resolveLifecycleAction({ isPending, userId });
    if (action === "identify") {
      // resolveLifecycleAction 已判定 userId 存在；TS 需显式收窄。
      if (userId) {
        identify(userId);
      }
    } else if (action === "reset") {
      reset();
    }
  }, [isPending, userId, identify, reset]);

  // 客户信息推送（购买/续费/到期）→ 失效账单查询。不可用时返回空取消函数。
  useEffect(
    () => addCustomerInfoListener(() => invalidateBillingQueries(queryClient)),
    [addCustomerInfoListener, queryClient],
  );

  return null;
}

export function BillingProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale?: string;
}) {
  return (
    <StrategyProvider locale={locale}>
      <BillingLifecycle />
      {children}
    </StrategyProvider>
  );
}
