// 聊天入口薄壳：布局与逻辑在 modules/chat（Task 9）。此文件仅注册路由，
// 使 `/chat` 出现在类型化路由树中（Task 8 的导航项 `to: "/chat"` 依赖它）。
// 独立无壳无鉴权布局组（workbench）：不套 AppShell、不要求登录。

import { createFileRoute } from "@tanstack/react-router";

import { ai } from "@/modules/ai/lib/api";
import { ChatPage } from "@/modules/chat/components/chat-page";

export const Route = createFileRoute("/(workbench)/chat")({
  // hover 预取模型目录 + 首页会话，点击后聊天页 useQuery 直接命中缓存。
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.prefetchQuery(ai.queries.models()),
      queryClient.prefetchQuery(ai.queries.chats(1)),
    ]),
  component: ChatPage,
});
