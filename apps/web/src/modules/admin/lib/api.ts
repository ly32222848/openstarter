// Query 工厂：admin 模块（R25/R26 管理后台）
// 数据面经类型化 RPC（`client.api.admin.*`）→ packages/api（requirePermission admin.*）。

import { mutationOptions, queryOptions } from "@tanstack/react-query";
import type { InferRequestType, InferResponseType } from "hono/client";

import { client } from "@/lib/api";

const PAGE_SIZE = 20;

/** `ai_model` 目录行的媒体类型（与后端 AI_MEDIA_TYPES 一致）。 */
export const AI_MODEL_MEDIA_TYPES = ["text", "image", "video", "music", "speech"] as const;

export type AiModelMediaType = (typeof AI_MODEL_MEDIA_TYPES)[number];

const getAiModels = client.api.admin["ai-models"].$get;
const createAiModel = client.api.admin["ai-models"].$post;

type AiModelListData = NonNullable<InferResponseType<typeof getAiModels, 200>["data"]>;

/** admin 模型列表行，直接从 RPC 响应推导。 */
export type AiModelRow = AiModelListData["items"][number];

/** admin 模型创建请求体，直接从后端 zod schema 推导。 */
export type AiModelPayload = InferRequestType<typeof createAiModel>["json"];

const queries = {
  aiModels: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin["ai-models"].$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load AI models");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "ai-models", page] as const,
    }),
  config: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.config.$get();
        if (!res.ok) {
          throw new Error("Failed to load settings");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "config"] as const,
    }),
  credits: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.credits.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load credits");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "credits", page] as const,
    }),
  metrics: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.analytics.metrics.$get();
        if (!res.ok) {
          throw new Error("Failed to load metrics");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "metrics"] as const,
    }),
  orders: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.orders.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load orders");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "orders", page] as const,
    }),
  permissions: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.permissions.$get();
        if (!res.ok) {
          throw new Error("Failed to load permissions");
        }
        return (await res.json()).data ?? [];
      },
      queryKey: ["admin", "permissions"] as const,
    }),
  rolePermissions: (roleId: string | null) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.roles[":id"].permissions.$get({
          param: { id: roleId ?? "" },
        });
        if (!res.ok) {
          throw new Error("Failed to load role permissions");
        }
        return (await res.json()).data ?? [];
      },
      queryKey: ["admin", "roles", roleId, "permissions"] as const,
    }),
  roles: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.roles.$get();
        if (!res.ok) {
          throw new Error("Failed to load roles");
        }
        return (await res.json()).data ?? [];
      },
      queryKey: ["admin", "roles"] as const,
    }),
  subscriptions: (page: number) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.subscriptions.$get({
          query: { page: String(page), pageSize: String(PAGE_SIZE) },
        });
        if (!res.ok) {
          throw new Error("Failed to load subscriptions");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "subscriptions", page] as const,
    }),
  users: (page: number, search: string) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.admin.users.$get({
          query: {
            page: String(page),
            pageSize: String(PAGE_SIZE),
            ...(search ? { search } : {}),
          },
        });
        if (!res.ok) {
          throw new Error("Failed to load users");
        }
        return (await res.json()).data;
      },
      queryKey: ["admin", "users", page, search] as const,
    }),
};

const mutations = {
  deleteAiModel: () =>
    mutationOptions({
      mutationFn: async (id: string) => {
        const res = await client.api.admin["ai-models"][":id"].$delete({ param: { id } });
        if (!res.ok) {
          throw new Error("Failed to delete AI model");
        }
      },
    }),
  deleteRole: () =>
    mutationOptions({
      mutationFn: async (id: string) => {
        const res = await client.api.admin.roles[":id"].$delete({
          param: { id },
        });
        if (!res.ok) {
          throw new Error("Failed to delete role");
        }
      },
    }),
  saveAiModel: () =>
    mutationOptions({
      mutationFn: async (input: AiModelPayload & { id: string | null }) => {
        if (input.id) {
          // update：body 中所有字段可选（后端 updateBody 只更新提交的键）。
          const { id, ...body } = input;
          const res = await client.api.admin["ai-models"][":id"].$patch({
            json: body,
            param: { id },
          });
          if (!res.ok) {
            const json = (await res.json().catch(() => null)) as { message?: string } | null;
            throw new Error(json?.message ?? "Failed to update AI model");
          }
          return;
        }
        // create：后端 createBody 校验必填字段。
        const res = await client.api.admin["ai-models"].$post({
          json: {
            provider: input.provider,
            modelId: input.modelId,
            displayName: input.displayName,
            mediaType: input.mediaType,
            creditPrice: input.creditPrice,
            maxOutputTokens: input.maxOutputTokens,
            optionsSchema: input.optionsSchema,
            metadata: input.metadata ?? null,
            enabled: input.enabled,
            sortOrder: input.sortOrder,
          },
        });
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { message?: string } | null;
          // 重复 (provider, modelId) 由后端返回 409 信封（DuplicateModelError）；按状态码分流。
          throw new Error(
            res.status === 409
              ? "Model already exists for this provider"
              : (json?.message ?? "Failed to create AI model"),
          );
        }
      },
    }),
  toggleAiModel: () =>
    mutationOptions({
      mutationFn: async (input: { id: string; enabled: boolean }) => {
        const res = await client.api.admin["ai-models"][":id"].$patch({
          json: { enabled: input.enabled },
          param: { id: input.id },
        });
        if (!res.ok) {
          throw new Error("Failed to update AI model");
        }
      },
    }),
  saveConfig: () =>
    mutationOptions({
      mutationFn: async (payload: Record<string, string>) => {
        const res = await client.api.admin.config.$post({ json: payload });
        if (!res.ok) {
          const text = await res.json().catch(() => null);
          const message = (text as { error?: string } | null)?.error ?? "Failed to save";
          throw new Error(message);
        }
      },
    }),
  saveRole: () =>
    mutationOptions({
      mutationFn: async (input: { id: string | null; name: string; title: string }) => {
        if (input.id) {
          const res = await client.api.admin.roles[":id"].$put({
            json: { name: input.name, title: input.title },
            param: { id: input.id },
          });
          if (!res.ok) {
            throw new Error("Failed to update role");
          }
          return;
        }
        const res = await client.api.admin.roles.$post({
          json: { name: input.name, title: input.title },
        });
        if (!res.ok) {
          throw new Error("Failed to create role");
        }
      },
    }),
  saveRolePermissions: () =>
    mutationOptions({
      mutationFn: async (input: { id: string; permissionIds: string[] }) => {
        const res = await client.api.admin.roles[":id"].permissions.$put({
          json: { permissionIds: input.permissionIds },
          param: { id: input.id },
        });
        if (!res.ok) {
          throw new Error("Failed to save permissions");
        }
      },
    }),
};

export const admin = { mutations, queries } as const;
