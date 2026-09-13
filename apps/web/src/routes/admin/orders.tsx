// apps/web/src/routes/admin/orders.tsx
// 订单管理（R26.2）：分页列表。

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
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/admin/orders")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
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
      <AdminHeader
        description={m["admin.orders.description"]()}
        title={m["admin.orders.title"]()}
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.orders.no_orders"]()}
        error={ordersQuery.error as Error | null}
        loading={ordersQuery.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m["admin.orders.order_col"]()}</TableHead>
                <TableHead>{m["admin.orders.user_col"]()}</TableHead>
                <TableHead>{m["admin.orders.product_col"]()}</TableHead>
                <TableHead>{m["admin.orders.amount_col"]()}</TableHead>
                <TableHead>{m["admin.orders.provider_col"]()}</TableHead>
                <TableHead>{m["admin.orders.status_col"]()}</TableHead>
                <TableHead>{m["admin.orders.created_col"]()}</TableHead>
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
