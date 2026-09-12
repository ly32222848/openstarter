// apps/web/src/routes/admin/orders.tsx
// 订单管理（R26.2）：分页列表。数据经 GET /api/admin/orders（requirePermission admin.*）。
// 分页状态经 validateSearch 进 URL（刷新/后退/分享可恢复视图）。

import { Badge } from "@openstarter/ui-web/components/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstarter/ui-web/components/table";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { countTotalPages, listSearchParams, LIST_PAGE_SIZE } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import { admin } from "@/modules/admin/lib/api";

export const Route = createFileRoute("/admin/orders")({
  validateSearch: listSearchParams,
  // URL 分页参数透传给 loader（loaderDeps 变化 → loader 重跑，预取对应页）。
  loaderDeps: ({ search }) => search,
  // hover 预取：按 URL 当前页预取，组件挂载即命中缓存。
  loader: preloadQueries((deps) => [admin.queries.orders(Number(deps.page) || 1)]),
  component: AdminOrdersPage,
});

function formatAmount(amount: number, currency: string): string {
  return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
}

function AdminOrdersPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const ordersQuery = useQuery(admin.queries.orders(page));

  const items = ordersQuery.data?.items ?? [];
  const total = ordersQuery.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  const handlePageChange = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }), replace: true });
  };

  return (
    <div>
      <AdminHeader description="All customer orders." title="Orders" />

      <StatusText
        empty={items.length === 0}
        emptyLabel="No orders found."
        error={ordersQuery.error as Error | null}
        loading={ordersQuery.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono text-muted-foreground text-xs">
                    {item.orderNo}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {item.userEmail ?? item.userId}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.productName ?? item.productId ?? "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatAmount(item.amount, item.currency)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.paymentProvider}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "paid" ? "secondary" : "outline"}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <Pagination onPageChange={handlePageChange} page={page} totalPages={totalPages} />
    </div>
  );
}
