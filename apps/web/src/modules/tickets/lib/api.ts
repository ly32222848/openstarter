// Query 工厂：tickets 模块（R21）
// 数据面经类型化 RPC（`client.api.tickets`）→ packages/api（requireAuth）。
// tickets 属 user 域资源，key 走 userKeys 工厂（tickets 嵌套在 ["user","tickets"] 前缀下，
// 组件按前缀失效列表/详情均可命中，手写 key 漂移在此根除）。

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";
import { userKeys } from "@/modules/user/lib/api";

const queries = {
  detail: (id: string | null) =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.tickets[":id"].$get({
          param: { id: id ?? "" },
        });
        if (!res.ok) {
          throw new Error("Failed to load ticket");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: userKeys.tickets.detail(id),
    }),
  list: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.tickets.$get({ query: {} });
        if (!res.ok) {
          throw new Error("Failed to load tickets");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: userKeys.tickets.all,
    }),
};

const mutations = {
  create: () =>
    mutationOptions({
      mutationFn: async (input: { title: string; content: string }) => {
        const res = await client.api.tickets.$post({ json: input });
        if (!res.ok) {
          throw new Error("Failed to create ticket");
        }
        const json = await res.json();
        if (!json.data) {
          throw new Error("Failed to create ticket");
        }
        return json.data;
      },
    }),
  reply: () =>
    mutationOptions({
      mutationFn: async (input: { id: string; content: string }) => {
        const res = await client.api.tickets[":id"].messages.$post({
          json: { content: input.content },
          param: { id: input.id },
        });
        if (!res.ok) {
          throw new Error("Failed to send reply");
        }
        const json = await res.json();
        if (!json.data) {
          throw new Error("Failed to send reply");
        }
        return json.data;
      },
    }),
};

export const tickets = { mutations, queries } as const;
