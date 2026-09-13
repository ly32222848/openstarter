// apps/web/src/routes/admin/users.tsx
// 用户管理（R26.2）：分页列表 + 邮箱搜索。

import { Badge } from "@openstarter/ui-web/components/badge";
import { Input } from "@openstarter/ui-web/components/input";
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
import { useEffect, useRef, useState } from "react";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { countTotalPages, listUsersSearchParams, LIST_PAGE_SIZE } from "@/lib/list-search";
import { preloadQueries } from "@/lib/preload";
import { admin } from "@/modules/admin/lib/api";
import { m } from "@/paraglide/messages.js";

export const Route = createFileRoute("/admin/users")({
  validateSearch: listUsersSearchParams,
  loaderDeps: ({ search }) => search,
  loader: preloadQueries((deps) => [
    admin.queries.users(Number(deps.page) || 1, String(deps.q ?? "")),
  ]),
  component: AdminUsersPage,
});

const SEARCH_DEBOUNCE_MS = 300;

function AdminUsersPage() {
  const { page, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [searchInput, setSearchInput] = useState(q);
  const pushedRef = useRef(q);

  useEffect(() => {
    if (q !== pushedRef.current) {
      pushedRef.current = q;
      setSearchInput(q);
    }
  }, [q]);

  useEffect(() => {
    if (searchInput === pushedRef.current) {
      return;
    }
    const timer = setTimeout(() => {
      pushedRef.current = searchInput;
      void navigate({
        search: (prev) => ({ ...prev, page: 1, q: searchInput || undefined }),
        replace: true,
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [navigate, searchInput]);

  const usersQuery = useQuery(admin.queries.users(page, q));

  const items = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = countTotalPages(total, LIST_PAGE_SIZE);

  const handlePageChange = (next: number) => {
    void navigate({ search: (prev) => ({ ...prev, page: next }), replace: true });
  };

  return (
    <div>
      <AdminHeader
        description={m["admin.users.all_registered"]()}
        title={m["admin.users.title"]()}
      />
      <div className="mb-4 max-w-xs">
        <Input
          aria-label={m["admin.users.search_placeholder"]()}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={m["admin.users.search_placeholder"]()}
          type="search"
          value={searchInput}
        />
      </div>

      <StatusText
        empty={items.length === 0}
        emptyLabel={m["admin.users.no_users_found"]()}
        error={usersQuery.error as Error | null}
        loading={usersQuery.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{m["admin.users.name_col"]()}</TableHead>
                <TableHead>{m["admin.users.email_col_label"]()}</TableHead>
                <TableHead>{m["admin.users.verified_col"]()}</TableHead>
                <TableHead>{m["admin.users.created_col"]()}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.email}</TableCell>
                  <TableCell>
                    {item.emailVerified ? (
                      <Badge variant="secondary">{m["common.verified"]()}</Badge>
                    ) : (
                      <Badge variant="outline">{m["common.unverified"]()}</Badge>
                    )}
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
