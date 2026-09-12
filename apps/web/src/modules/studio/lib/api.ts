// Query 工厂：studio 模块（生成任务）。布局与交互在 components/。
// 数据面经类型化 RPC（`client.api["ai-tasks"]`）→ packages/api（requireAuth + requirePlan）。
// 缓存键走 @openstarter/ai-web 的 aiKeys 工厂（key 属主）：studio 与 ai 模块共享同一份
// 任务数据，两侧都必须引用 aiKeys.tasks——手写数组会让 invalidate 前缀与工厂 key 静默漂移。

import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";

import { client } from "@/lib/api";
import { aiKeys } from "@/modules/ai/lib/api";
import { LIST_PAGE_SIZE } from "@/lib/list-search";

const PAGE_SIZE = LIST_PAGE_SIZE;

/** studio 工作台支持的媒体类型（brief 约定：不含 text/speech）。 */
export const STUDIO_MEDIA_TYPES = ["image", "video", "music"] as const;

export type StudioMediaTypeId = (typeof STUDIO_MEDIA_TYPES)[number];

/** 生成任务终态：任务全部进入终态后停止轮询。 */
export const TERMINAL_TASK_STATUSES = ["success", "failed", "canceled"] as const;

const getTasks = client.api["ai-tasks"].$get;
const createTask = client.api["ai-tasks"].$post;

type TaskPage = NonNullable<InferResponseType<typeof getTasks, 200>["data"]>;

/** 序列化后的 `ai_task` 行，直接从 RPC 响应推导。 */
export type AiTaskRow = TaskPage["items"][number];

type CreateTaskRequest = InferRequestType<typeof createTask>["json"];

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
        return json.data;
      },
      queryKey: aiKeys.tasks.list(input),
      placeholderData: keepPreviousData,
    }),
};

const mutations = {
  createTask: () =>
    mutationOptions({
      mutationFn: async (input: CreateTaskRequest & { mediaType: StudioMediaTypeId }) => {
        const res = await client.api["ai-tasks"].$post({ json: input });
        if (!res.ok) {
          throw new Error("Failed to create generation task");
        }
        const json = await res.json();
        if (!json.data) {
          throw new Error("Failed to create generation task");
        }
        return json.data;
      },
      onSuccess: (_data, _variables, _onMutateResult, context) => {
        // 前缀失效所有 mediaType/页码的任务查询（新任务可能不出现在当前 tab，
        // 但积分余额等侧翼数据共享同一查询面，按属主工厂前缀失效最稳）。
        void context.client.invalidateQueries({ queryKey: aiKeys.tasks.all });
      },
    }),
};

export const studio = { mutations, queries } as const;
