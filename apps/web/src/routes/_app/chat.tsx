// 聊天入口薄壳：布局与逻辑在 modules/chat（Task 9）。此文件仅注册路由，
// 使 `/chat` 出现在类型化路由树中（Task 8 的导航项 `to: "/chat"` 依赖它）。

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});

function ChatPage() {
  return null;
}
