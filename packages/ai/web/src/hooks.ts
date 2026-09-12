// packages/ai/web/hooks —— AI 查询/变更 hooks（Task 12，自 apps/web query 工厂下沉）。
//
// 把 apps/web/src/modules/ai/lib/api.ts 的查询工厂逻辑下沉为可复用函数；模块级客户端实例
// 经 `setAIBaseUrl(baseUrl)` 初始化（默认 "/"），hooks 内部走该实例。web 端调用点保持不变
// （apps/web 侧 re-export 本包）。

import { keepPreviousData, mutationOptions, queryOptions } from "@tanstack/react-query";

import { createAIClient } from "./client";

const PAGE_SIZE = 20;

/** 模块级类型化客户端实例（默认相对根路径；各端启动时经 setAIBaseUrl 注入）。 */
let moduleClient = createAIClient("/");

/**
 * 初始化模块级客户端 baseUrl（desktop/extension 等端注入各自 baseUrl；默认 "/"）。
 * 幂等：以最后一次调用为准。
 */
export function setAIBaseUrl(baseUrl: string): void {
  moduleClient = createAIClient(baseUrl);
}

/** 当前模块级客户端（测试与高级用法可直取）。 */
export function getAIClient() {
  return moduleClient;
}

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

/**
 * ai 域 query key 工厂（qk-factory-pattern）。
 * key 归属本包：apps/web 的 studio 等消费方复用 `["ai","tasks"]` 缓存时，
 * 必须经 `aiKeys.tasks(...)` 取 key，禁止手写数组——否则 invalidate 前缀
 * 与工厂 key 会静默漂移。
 */
export const aiKeys = {
  all: ["ai"] as const,
  models: () => ["ai", "models"] as const,
  chats: {
    all: ["ai", "chats"] as const,
    list: (page: number) => ["ai", "chats", page] as const,
  },
  chatMessages: (chatId: string, page: number) => ["ai", "chat-messages", chatId, page] as const,
  tasks: {
    /** 失效前缀：任意 mediaType/页码的任务查询都被命中。 */
    all: ["ai", "tasks"] as const,
    list: (input: { mediaType?: string; page: number }) =>
      ["ai", "tasks", input.mediaType ?? "all", input.page] as const,
  },
};

export const queries = {
  models: () =>
    queryOptions({
      queryFn: async () => {
        const res = await moduleClient.api.ai.models.$get();
        if (!res.ok) {
          throw new Error("Failed to load AI models");
        }
        const json = await res.json();
        return json.data as ModelCatalog;
      },
      queryKey: aiKeys.models(),
    }),
  chats: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await moduleClient.api.llm.chats.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load chats");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: aiKeys.chats.list(page),
    }),
  chatMessages: (chatId: string, page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await moduleClient.api.llm.chats[":id"].messages.$get({
          param: { id: chatId },
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load chat messages");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: aiKeys.chatMessages(chatId, page),
    }),
  tasks: (input: { mediaType?: string; page: number }) =>
    queryOptions({
      queryFn: async () => {
        const mediaType =
          input.mediaType !== undefined && isAiMediaType(input.mediaType)
            ? input.mediaType
            : undefined;
        const res = await moduleClient.api["ai-tasks"].$get({
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
      queryKey: aiKeys.tasks.list(input),
      // 翻页保留上一页数据（分页列表统一行为）。
      placeholderData: keepPreviousData,
    }),
};

export const mutations = {
  createChat: () =>
    mutationOptions({
      mutationFn: async (input: { title?: string; provider?: string; model?: string }) => {
        const res = await moduleClient.api.llm.chats.$post({ json: input });
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
        void context.client.invalidateQueries({ queryKey: aiKeys.chats.all });
      },
    }),
  deleteChat: () =>
    mutationOptions({
      mutationFn: async (input: { id: string }) => {
        const res = await moduleClient.api.llm.chats[":id"].$delete({ param: { id: input.id } });
        if (!res.ok) {
          throw new Error("Failed to delete chat");
        }
        return input.id;
      },
      onSuccess: (_data, _variables, _onMutateResult, context) => {
        void context.client.invalidateQueries({ queryKey: aiKeys.chats.all });
      },
    }),
};

/** AI 域 TanStack Query 工厂（与 apps/web 侧 re-export 保持一致）。 */
export const ai = { mutations, queries } as const;
