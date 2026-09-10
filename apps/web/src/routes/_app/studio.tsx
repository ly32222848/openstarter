// 生成工作台入口薄壳：布局与逻辑在 modules/studio（Task 10）。此文件仅注册路由，
// 使 `/studio` 出现在类型化路由树中（Task 8 的导航项 `to: "/studio"` 依赖它）。

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/studio")({
  component: StudioPage,
});

function StudioPage() {
  return null;
}
