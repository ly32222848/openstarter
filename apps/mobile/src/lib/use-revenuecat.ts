// apps/mobile/src/lib/use-revenuecat.ts —— 根布局挂载的 RC 生命周期接线。
//
// 职责（Task B3）：
//   1. 会话变化 → identify/reset：better-auth userId 即 RC app_user_id，
//      服务端 webhook 拿 app_user_id 归属订单，零映射；
//   2. customerInfo 更新（购买/续费/到期推送）→ 失效账单相关查询缓存，
//      让 billing/credits/orders 三屏自动反映最新状态。
//
// 门面永不抛错：接线层只需 fire-and-forget，不需要 try/catch。
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { authClient } from "./auth-client";
import {
  addCustomerInfoUpdateListener,
  identify,
  initPurchases,
  resetPurchases,
} from "./purchases";

/** customerInfo 变化需要刷新的查询缓存（账单三屏 + 方案徽章）。 */
const BILLING_QUERY_KEYS: ReadonlySet<string> = new Set([
  "user-plan",
  "user-subscription",
  "user-credits",
  "user-orders",
]);

/** 按 queryKey 首段失效账单查询（["user-orders", page] 这类带参键一并命中）。 */
function invalidateBillingQueries(
  queryClient: ReturnType<typeof useQueryClient>,
): void {
  for (const key of BILLING_QUERY_KEYS) {
    void queryClient.invalidateQueries({ queryKey: [key] });
  }
}

export function useRevenueCatLifecycle(): void {
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const userId = session?.user?.id;

  // RC SDK configure（幂等）；不可用时后续调用全部自动降级为 no-op。
  useEffect(() => {
    void initPurchases();
  }, []);

  // 会话变化：登录 → logIn(userId)；登出 → logOut()。
  // isPending 期间不动，避免把读会话中间态当成登出。
  useEffect(() => {
    if (isPending) {
      return;
    }
    if (userId) {
      void identify(userId);
    } else {
      void resetPurchases();
    }
  }, [isPending, userId]);

  // customerInfo 推送 → 失效账单查询。门面在不可用时返回空取消函数。
  useEffect(() => {
    const unsubscribe = addCustomerInfoUpdateListener(() => {
      invalidateBillingQueries(queryClient);
    });
    return unsubscribe;
  }, [queryClient]);
}
