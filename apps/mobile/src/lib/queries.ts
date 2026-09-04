// apps/mobile/src/lib/queries.ts —— 经类型化客户端拉数据的 TanStack Query 钩子。
//
// 会话状态刻意不进 Query：它走 authClient.useSession() 自己的 store，
// 两套缓存并存只会互相打架（见 spec §5.4）。
//
// 每个查询都返回 ApiResult 而不是抛异常：401 是"未登录"而不是错误，
// 交给界面按 status 分流（见 spec §7）。因此 queryFn 永不 reject，
// retry 也就没有意义 —— 重试由界面上的显式按钮驱动。
import { useMutation, useQuery } from "@tanstack/react-query";

import { apiClient } from "./api";
import { type ApiResult, runRequest } from "./api-error";
import type { PublicConfig } from "./public-config";

const PUBLIC_CONFIG_STALE_MS = 5 * 60 * 1000;

export interface UserPlanView {
  plan: string;
  trialEndsAt: string | null;
}

export function usePublicConfig() {
  return useQuery({
    queryFn: async (): Promise<PublicConfig> => {
      const result = await runRequest(
        () => apiClient.api.config.public.$get(),
        (body) => (body as { data?: PublicConfig }).data ?? {},
      );
      // 公开配置拿不到时退回空对象：resolveEnabledProviders({}) 的结果是
      // "只有邮箱密码"，这是最保守也最不会 404 的降级（见 spec §6）。
      return result.status === "success" ? result.data : {};
    },
    queryKey: ["public-config"],
    staleTime: PUBLIC_CONFIG_STALE_MS,
  });
}

export function useUserPlan() {
  return useQuery({
    queryFn: (): Promise<ApiResult<UserPlanView>> =>
      runRequest(
        () => apiClient.api.user.plan.$get(),
        (body) => {
          // JSON 线上传输：Date 序列化为 ISO 字符串，故 trialEndsAt 是 string 而非 Date。
          const { data } = body as {
            data: { plan: string; trialEndsAt?: string };
          };
          return { plan: data.plan, trialEndsAt: data.trialEndsAt ?? null };
        },
      ),
    queryKey: ["user-plan"],
    retry: false,
  });
}

/** GET /user/subscription —— 当前订阅状态视图（hasSubscription/status/planName/nextBillingDate）。 */
export interface UserSubscriptionView {
  hasSubscription: boolean;
  nextBillingDate: string | null;
  planName: string | null;
  status: string | null;
}

export function useUserSubscription() {
  return useQuery({
    queryFn: (): Promise<ApiResult<UserSubscriptionView>> =>
      runRequest(
        () => apiClient.api.user.subscription.$get(),
        (body) => {
          const { data } = body as {
            data: {
              hasSubscription: boolean;
              nextBillingDate?: string | null;
              planName?: string | null;
              status?: string | null;
            };
          };
          return {
            hasSubscription: data.hasSubscription,
            nextBillingDate: data.nextBillingDate ?? null,
            planName: data.planName ?? null,
            status: data.status ?? null,
          };
        },
      ),
    queryKey: ["user-subscription"],
    retry: false,
  });
}

/** GET /user/credits 响应：余额 + 流水（limit/offset 分页，非整页语义）。 */
export interface UserCreditsView {
  balance: number;
  history: Array<{
    credits: number;
    description?: string | null;
    expiresAt?: string | null;
    remainingCredits: number;
    transactionNo: string;
    transactionScene?: string | null;
    transactionType: string;
  }>;
}

const CREDITS_HISTORY_LIMIT = 50;

export function useUserCredits() {
  return useQuery({
    queryFn: (): Promise<ApiResult<UserCreditsView>> =>
      runRequest(
        () =>
          apiClient.api.user.credits.$get({
            // AppType 对该端点的 query 推导为 string：z.coerce.number() 在服务端自行转数字。
            query: { limit: String(CREDITS_HISTORY_LIMIT), offset: "0" },
          }),
        (body) => {
          const { data } = body as {
            data: {
              balance: number;
              history?: UserCreditsView["history"];
            };
          };
          return { balance: data.balance, history: data.history ?? [] };
        },
      ),
    queryKey: ["user-credits"],
    retry: false,
  });
}

/** GET /user/orders 单页结果（page/pageSize 分页，respPage 信封带 total）。 */
export interface UserOrdersPage {
  items: Array<{
    amount: number;
    currency: string;
    orderNo: string;
    paidAt?: string | null;
    paymentProvider: string;
    paymentType?: string | null;
    productName?: string | null;
    status: string;
  }>;
  total: number;
}

export function useUserOrders(page: number) {
  const PAGE_SIZE = 20;
  return useQuery({
    queryFn: (): Promise<ApiResult<UserOrdersPage>> =>
      runRequest(
        () =>
          apiClient.api.user.orders.$get({
            // AppType 对该端点的 query 推导为 string：z.coerce.number() 在服务端自行转数字。
            query: { page: String(page), pageSize: String(PAGE_SIZE) },
          }),
        (body) => {
          // respPage 信封：{ code, message, data: items[], page, total }。
          const envelope = body as {
            data?: UserOrdersPage["items"];
            total?: number;
          };
          return { items: envelope.data ?? [], total: envelope.total ?? 0 };
        },
      ),
    queryKey: ["user-orders", page],
    retry: false,
  });
}

/** POST /user/billing-portal —— Stripe 客户门户跳转 URL（非 Stripe 订阅后端 400）。 */
export function useBillingPortalMutation() {
  return useMutation({
    mutationFn: async (): Promise<ApiResult<{ billingUrl: string }>> =>
      runRequest(
        () => apiClient.api.user["billing-portal"].$post(),
        (body) => {
          const { data } = body as { data?: { billingUrl?: string } };
          return { billingUrl: data?.billingUrl ?? "" };
        },
      ),
  });
}
