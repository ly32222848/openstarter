import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";
import { BRAND_NAME } from "@/lib/branding";
import { publicConfig } from "@/modules/public-config/lib/api";

export const Route = createFileRoute("/_auth-pages")({
  ssr: false,
  beforeLoad: async () => {
    const session = await authClient.getSession();
    if (session.data) {
      throw redirect({ to: "/dashboard" });
    }
  },
  // 认证页共享的 publicConfig 在布局 loader 里预取（而非各表单组件内 fetch-on-render）。
  // 各组件 `useQuery(publicConfig.queries.get())` 命中同一 `["public-config"]` key 与
  // 5m staleTime，预取后同步读缓存、不再重复请求（load-use-loaders）。
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(publicConfig.queries.get()),
  component: AuthPagesLayout,
});

function AuthPagesLayout() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 px-4">
      <span className="font-semibold text-lg">{BRAND_NAME}</span>
      {/* 认证页此前缺少 main landmark；同时作为 skip-to-content 的目标。 */}
      <main id="main" className="w-full max-w-md">
        <Outlet />
      </main>
    </div>
  );
}
