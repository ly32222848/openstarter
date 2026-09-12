// apps/web/src/routes/admin/credits.tsx
// 积分管理（R26.2）：分页列表。数据经 GET /api/admin/credits（requirePermission admin.*）。
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

export const Route = createFileRoute("/admin/credits")({
  validateSearch: listSearchParams,
  // URL 分页参数透传给 loader（loaderDeps 变化 → loader 重跑，预取对应页）。
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [admin.queries.credits(Number(deps.page) || 1)]),
  component: AdminCreditsPage,
});

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : "Never";
}

function AdminCreditsPage() {
  const { page } = Route.useSearch();
  const navigate = Route.useNavigate();

  const query = useQuery(admin.queries.credits(page));

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  const handlePageChange = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }), replace: true });
  };

  return (
    <div>
      <AdminHeader description="All credit transactions." title="Credits" />

      <StatusText
        empty={items.length === 0}
        emptyLabel="No credit transactions found."
        error={query.error as Error | null}
        loading={query.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-muted-foreground">
                    {item.userEmail ?? item.userId}
                  </TableCell>
                  <TableCell>
                    <Badge variant={item.transactionType === "grant" ? "secondary" : "outline"}>
                      {item.transactionType}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">{item.credits}</TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {item.remainingCredits}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.expiresAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(item.createdAt)}
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
