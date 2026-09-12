// apps/web/src/routes/_app/settings/apikeys.tsx
// API 密钥自助管理（R8 / R27.2）：创建（明文一次性展示）、列表（仅前缀）、吊销。
// 数据面经类型化 RPC（`client.api.apikeys`）→ packages/api（requireAuth）→ Auth APIKey_Service。
import { createFileRoute } from "@tanstack/react-router";
import { ApiKeysPage } from "@/components/app/settings/apikeys";
import { user } from "@/modules/user/lib/api";

export const Route = createFileRoute("/_app/settings/apikeys")({
  // hover 预取密钥列表，点击后组件 useQuery 命中缓存。
  loader: ({ context: { queryClient } }) => queryClient.prefetchQuery(user.queries.apiKeys()),
  component: ApiKeysPage,
});
