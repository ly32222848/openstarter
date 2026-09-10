// Query 工厂：ai 模块（模型目录 / 聊天会话 / 生成任务）。
// 数据面经类型化 RPC（`client.api.ai.models` / `client.api.llm.chats` / `client.api["ai-tasks"]`）→ packages/api。

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

const PAGE_SIZE = 20;

/** UI 消费的模型视图：目录行中与界面相关的列（信封 data 内为完整 AiModel 行）。 */
export type AiModelView = {
  id: string;
  provider: string;
  modelId: string;
  displayName: string;
  mediaType: string;
  creditPrice: number;
  maxOutputTokens: number | null;
  optionsSchema: string | null;
};

type ModelCatalog = Record<string, AiModelView[]>;

/** AI 生成媒体类型，与后端 `AIMediaType`（packages/api types.ts）保持一致。 */
const AI_MEDIA_TYPES = ["text", "image", "video", "music", "speech"] as const;
type AiMediaType = (typeof AI_MEDIA_TYPES)[number];

const isAiMediaType = (value: string): value is AiMediaType =>
  (AI_MEDIA_TYPES as readonly string[]).includes(value);

const queries = {
  models: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.ai.models.$get();
        if (!res.ok) {
          throw new Error("Failed to load AI models");
        }
        const json = await res.json();
        return json.data as ModelCatalog;
      },
      queryKey: ["ai", "models"] as const,
    }),
  chats: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.llm.chats.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load chats");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: ["ai", "chats", page] as const,
    }),
  tasks: (input: { mediaType?: string; page: number }) =>
    queryOptions({
      queryFn: async () => {
        const mediaType =
          input.mediaType !== undefined && isAiMediaType(input.mediaType)
            ? input.mediaType
            : undefined;
        const res = await client.api["ai-tasks"].$get({
          query: {
            page: String(input.page),
            pageSize: String(PAGE_SIZE),
            ...(mediaType ? { mediaType } : {}),
          },
        });
        if (!res.ok) {
          throw new Error("Failed to load AI tasks");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: ["ai", "tasks", input.mediaType ?? "all", input.page] as const,
    }),
};

const mutations = {
  createChat: () =>
    mutationOptions({
      mutationFn: async (input: { title?: string; provider?: string; model?: string }) => {
        const res = await client.api.llm.chats.$post({ json: input });
        if (!res.ok) {
          throw new Error("Failed to create chat");
        }
        const json = await res.json();
        if (!json.data) {
          throw new Error("Failed to create chat");
        }
        return json.data;
      },
      onSuccess: (_data, _variables, _onMutateResult, context) => {
        void context.client.invalidateQueries({ queryKey: ["ai", "chats"] });
      },
    }),
  deleteChat: () =>
    mutationOptions({
      mutationFn: async (input: { id: string }) => {
        const res = await client.api.llm.chats[":id"].$delete({ param: { id: input.id } });
        if (!res.ok) {
          throw new Error("Failed to delete chat");
        }
        return input.id;
      },
      onSuccess: (_data, _variables, _onMutateResult, context) => {
        void context.client.invalidateQueries({ queryKey: ["ai", "chats"] });
      },
    }),
};

export const ai = { mutations, queries } as const;
