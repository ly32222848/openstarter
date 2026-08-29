// apps/web/src/routes/admin/users.tsx
// 用户管理（R26.2）：分页列表 + 邮箱搜索。数据经 GET /api/admin/users（requirePermission admin.*）。

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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AdminHeader, Pagination, StatusText } from "@/components/admin/list";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { admin } from "@/modules/admin/lib/api";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsersPage,
});

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  // 防抖后进 queryKey：避免每敲一个键就发一次 /api/admin/users 请求。
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const usersQuery = useQuery({
    ...admin.queries.users(page, debouncedSearch),
    placeholderData: keepPreviousData,
  });

  const items = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <AdminHeader description="All registered users." title="Users" />
      <div className="mb-4 max-w-xs">
        <Input
          aria-label="Search users by email"
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          placeholder="Search by email..."
          type="search"
          value={search}
        />
      </div>

      <StatusText
        empty={items.length === 0}
        emptyLabel="No users found."
        error={usersQuery.error as Error | null}
        loading={usersQuery.isPending}
      />

      {items.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="text-muted-foreground">{item.email}</TableCell>
                  <TableCell>
                    {item.emailVerified ? (
                      <Badge variant="secondary">Verified</Badge>
                    ) : (
                      <Badge variant="outline">Unverified</Badge>
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

      <Pagination onPageChange={setPage} page={page} totalPages={totalPages} />
    </div>
  );
}
