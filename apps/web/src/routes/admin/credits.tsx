// apps/web/src/routes/admin/credits.tsx
// 积分管理（R26.2）：分页列表。

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

export const Route = createFileRoute("/admin/credits")({
  validateSearch: listSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [admin.queries.credits(Number(deps.page) || 1)]),
  component: AdminCreditsPage,
});

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : m["common.never"]();
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
      <AdminHeader
        description={m["admin.credits.all_transactions"]()}
        title={m["admin.credits.title"]()}
      />

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.credits.no_transactions_found"]()}
        error={query.error as Error | null}
        loading={query.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m["admin.credits.user"]()}</TableHead>
                <TableHead>{m["admin.credits.type"]()}</TableHead>
                <TableHead>{m["admin.credits.amount"]()}</TableHead>
                <TableHead>{m["admin.credits.remaining"]()}</TableHead>
                <TableHead>{m["admin.credits.expires_at"]()}</TableHead>
                <TableHead>{m["admin.credits.created_at"]()}</TableHead>
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
