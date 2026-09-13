// apps/web/src/routes/admin/subscriptions.tsx
// 订阅管理（R26.2）：分页列表。

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

export const Route = createFileRoute("/admin/subscriptions")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [admin.queries.subscriptions(Number(deps.page) || 1)]),
  component: AdminSubscriptionsPage,
});

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

function AdminSubscriptionsPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const query = useQuery(admin.queries.subscriptions(page));

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  const handlePageChange = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }), replace: true });
  };

  return (
    <div>
      <AdminHeader
        description={m["admin.subscriptions.all_subscriptions_desc"]()}
        title={m["admin.subscriptions.title"]()}
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.subscriptions.no_subscriptions_found"]()}
        error={query.error as Error | null}
        loading={query.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m["admin.subscriptions.user"]()}</TableHead>
                <TableHead>{m["admin.subscriptions.plan_col"]()}</TableHead>
                <TableHead>{m["admin.subscriptions.provider"]()}</TableHead>
                <TableHead>{m["admin.subscriptions.status"]()}</TableHead>
                <TableHead>{m["admin.subscriptions.period_end_col"]()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">
                    {item.userEmail ?? item.userId}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.planName ?? item.productName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.paymentProvider}</TableCell>
                  <TableCell>
                    <Badge variant={item.status === "active" ? "secondary" : "outline"}>
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.currentPeriodEnd)}
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
