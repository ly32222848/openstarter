// 生成工作台入口薄壳：布局与逻辑在 modules/studio（Task 10）。

import { createFileRoute } from "@tanstack/react-router";

import { ai } from "@/modules/ai/lib/api";
import { StudioPage } from "@/modules/studio/components/studio-page";
import { STUDIO_MEDIA_TYPES, studio } from "@/modules/studio/lib/api";

export const Route = createFileRoute("/_app/studio")({
  // hover 预取模型目录 + 默认媒体类型（首个 tab）的任务首页；
  // queryKey 与 studio-page/task-list 挂载时的初始 state 保持一致，保证缓存命中。
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.prefetchQuery(ai.queries.models()),
      queryClient.prefetchQuery(
        studio.queries.tasks({ mediaType: STUDIO_MEDIA_TYPES[0], page: 1 }),
      ),
    ]),
  component: StudioPage,
});
