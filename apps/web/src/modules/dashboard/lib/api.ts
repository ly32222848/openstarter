// Query 工厂：dashboard 模块。
// 数据面经类型化 RPC（`client.api.user.dashboard-stats` / `client.api.user.orders`）→ packages/api。

import { queryOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

const queries = {
  stats: () =>
    queryOptions({
      queryFn: async () => {
        const res = await client.api.user["dashboard-stats"].$get();
        if (!res.ok) {
          throw new Error("Failed to load dashboard stats");
        }
        const json = await res.json();
        return json.data;
      },
      queryKey: ["dashboard", "stats"] as const,
    }),
};

export const dashboard = { queries } as const;
