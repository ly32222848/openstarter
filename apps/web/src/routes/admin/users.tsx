// apps/web/src/routes/admin/users.tsx
// 用户管理（R26.2）：分页列表 + 邮箱搜索。数据经 GET /api/admin/users（requirePermission admin.*）。
// 分页/搜索状态经 validateSearch 进 URL（刷新、后退/前进、分享链接可恢复视图）。

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

export const Route = createFileRoute("/admin/users")({
  validateSearch: listUsersSearchParams,
  // URL 的分页/搜索参数透传给 loader（loaderDeps 变化 → loader 重跑，预取对应页）。
  loaderDeps: ({ search }) => search,
  // hover 预取：按当前 URL 的分页/搜索预取，组件挂载即命中缓存。
  loader: preloadQueries((deps) => [
    admin.queries.users(Number(deps.page) || 1, String(deps.q ?? "")),
  ]),
  component: AdminUsersPage,
});

const SEARCH_DEBOUNCE_MS = 300;

function AdminUsersPage() {
  const { page, q } = Route.useSearch();
  const navigate = Route.useNavigate();
  // 输入框本地态即时回显；防抖后才写进 URL（避免每敲一键一条请求/历史）。
  // pushedRef 记录「最近一次由本页推入 URL 的值」，据此区分自身回写与外部导航
  // （后退/前进、手改地址栏），防止防抖尾巴覆盖外部变更。
  const [searchInput, setSearchInput] = useState(q);
  const pushedRef = useRef(q);

  useEffect(() => {
    // URL 是真相：外部导致的 q 变化 → 同步进输入框。
    if (q !== pushedRef.current) {
      pushedRef.current = q;
      setSearchInput(q);
    }
  }, [q]);

  useEffect(() => {
    // 本地编辑 → 防抖推入 URL（搜索变更回到第 1 页）。
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
      <AdminHeader description="All registered users." title="Users" />
      <div className="mb-4 max-w-xs">
        <Input
          aria-label="Search users by email"
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by email..."
          type="search"
          value={searchInput}
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

      <Pagination onPageChange={handlePageChange} page={page} totalPages={totalPages} />
    </div>
  );
}
