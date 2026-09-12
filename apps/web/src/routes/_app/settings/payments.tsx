// apps/web/src/routes/_app/settings/payments.tsx
// 支付记录自助视图（R27.2）：当前用户的订单分页列表。
// 数据面经类型化 RPC（`client.api.user.orders`）→ packages/api（requireAuth）→ user 读投影。
// 分页状态经 validateSearch 进 URL；ManageAccountDialog 里的同一组件无独立 URL，
// 走组件内部 local state 兜底（PaymentsPage 的分页 props 可选）。
import { createFileRoute } from "@tanstack/react-router";
import { PaymentsPage } from "@/components/app/settings/payments";
import { listSearchParams } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/settings/payments")({
  validateSearch: listSearchParams,
  // URL 分页参数透传给 loader（loaderDeps 变化 → loader 重跑，预取对应页）。
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [user.queries.orders(Number(deps.page) || 1)]),
  component: PaymentsRoute,
});

function PaymentsRoute() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <PaymentsPage
      onPageChange={(next) => {
        void navigate({ search: (prev) => ({ ...prev, page: next }), replace: true });
      }}
      page={page}
    />
  );
}
