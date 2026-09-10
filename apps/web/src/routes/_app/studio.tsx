// 生成工作台入口薄壳：布局与逻辑在 modules/studio（Task 10）。

import { createFileRoute } from "@tanstack/react-router";

import { StudioPage } from "@/modules/studio/components/studio-page";

export const Route = createFileRoute("/_app/studio")({
  component: StudioPage,
});
