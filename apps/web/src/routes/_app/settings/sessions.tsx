// apps/web/src/routes/_app/settings/sessions.tsx
// 会话列表：当前设备高亮 + 单个登出 + 登出其它全部。
import { createFileRoute } from "@tanstack/react-router";
import { SessionsPage } from "@/components/app/settings/sessions";
import { auth } from "@/modules/auth/lib/api";

export const Route = createFileRoute("/_app/settings/sessions")({
  // hover 预取会话列表。
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(auth.queries.sessions()),
  component: SessionsPage,
});
