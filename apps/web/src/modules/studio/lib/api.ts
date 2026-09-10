// Query 工厂：studio 模块（生成任务）。布局与交互在 components/。
// 数据面经类型化 RPC（`client.api["ai-tasks"]`）→ packages/api（requireAuth + requirePlan）。

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

const PAGE_SIZE = 20;

/** studio 工作台支持的媒体类型（brief 约定：不含 text/speech）。 */
export const STUDIO_MEDIA_TYPES = ["image", "video", "music"] as const;

export type StudioMediaTypeId = (typeof STUDIO_MEDIA_TYPES)[number];

/** 生成任务终态：任务全部进入终态后停止轮询。 */
export const TERMINAL_TASK_STATUSES = ["success", "failed", "canceled"] as const;

/** 序列化后的 `ai_task` 行（RPC 信封 data 内，JSON 字符串列仍为 string）。 */
export type AiTaskRow = {
  costCredits: number;
  createdAt: string;
  id: string;
  mediaType: string;
  model: string;
  options: string | null;
  prompt: string;
  provider: string;
  status: string;
  taskId: string | null;
  taskInfo: string | null;
  taskResult: string | null;
  userId: string;
};

/** 归一化任务信息（packages/api `AITaskInfo` 经 JSON 序列化的容错视图）。 */
export type AiTaskInfoView = {
  errorMessage?: string;
  images?: Array<{ imageUrl?: string }>;
  songs?: Array<{ audioUrl?: string; imageUrl?: string }>;
  status?: string;
  videos?: Array<{ thumbnailUrl?: string; videoUrl?: string }>;
};

const POLLING_INTERVAL_MS = 10_000;

/** 任务列表仍有未终态条目时每 10s 轮询一次，全部终态（或无数据）则停止。 */
export const taskRefetchInterval = (query: { state: { data?: unknown } }): number | false => {
  const data = query.state.data as { items?: Array<{ status?: string }> } | undefined;
  const isTerminal = (status: string | undefined): boolean =>
    status !== undefined && (TERMINAL_TASK_STATUSES as readonly string[]).includes(status);
  const hasPendingTask = (data?.items ?? []).some((task) => !isTerminal(task.status));
  return hasPendingTask ? POLLING_INTERVAL_MS : false;
};

const queries = {
  tasks: (input: { mediaType?: StudioMediaTypeId; page: number }) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api["ai-tasks"].$get({
          query: {
            page: String(input.page),
            pageSize: String(PAGE_SIZE),
            ...(input.mediaType ? { mediaType: input.mediaType } : {}),
          },
        });
        if (!res.ok) {
          throw new Error("Failed to load generation tasks");
        }
        const json = await res.json();
        if (!json.data) {
          throw new Error("Failed to load generation tasks");
        }
        return json.data as { items: AiTaskRow[]; total: number };
      },
      // 复用 ai.queries.tasks 的缓存键：studio 与 ai 模块共享同一份任务数据。
      queryKey: ["ai", "tasks", input.mediaType ?? "all", input.page] as const,
    }),
};

const mutations = {
  createTask: () =>
    mutationOptions({
      mutationFn: async (input: {
        mediaType: StudioMediaTypeId;
        model: string;
        options?: Record<string, unknown>;
        prompt: string;
        provider?: string;
      }) => {
        const res = await client.api["ai-tasks"].$post({ json: input });
        if (!res.ok) {
          throw new Error("Failed to create generation task");
        }
        const json = await res.json();
        if (!json.data) {
          throw new Error("Failed to create generation task");
        }
        return json.data as AiTaskRow;
      },
      onSuccess: (_data, _variables, _onMutateResult, context) => {
        void context.client.invalidateQueries({ queryKey: ["ai", "tasks"] });
      },
    }),
};

export const studio = { mutations, queries } as const;
