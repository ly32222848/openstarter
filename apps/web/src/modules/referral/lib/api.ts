// Query 工厂：referral 模块。key 所有权归本文件（referralKeys 前缀约定）。
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import type { InferResponseType } from "hono/client";

import { client } from "@/lib/api";

export const referralKeys = {
  all: ["referral"] as const,
  commissions: (page: number) => ["referral", "commissions", page] as const,
  me: () => ["referral", "me"] as const,
  relations: (page: number) => ["referral", "relations", page] as const,
};

const getMe = client.api.referral.me.$get;
type MeData = NonNullable<InferResponseType<typeof getMe, 200>["data"]>;
export type ReferralMe = MeData;

export const referral = {
  queries: {
    commissions: (page: number) =>
      queryOptions({
        placeholderData: keepPreviousData,
        queryFn: async () => {
          const res = await client.api.referral.commissions.$get({
            query: { page: String(page), pageSize: "20" },
          });
          if (!res.ok) {
            throw new Error("Failed to load commissions");
          }
          return (await res.json()).data;
        },
        queryKey: referralKeys.commissions(page),
      }),
    me: () =>
      queryOptions({
        queryFn: async () => {
          const res = await client.api.referral.me.$get();
          if (!res.ok) {
            throw new Error("Failed to load referral info");
          }
          return (await res.json()).data;
        },
        queryKey: referralKeys.me(),
      }),
    relations: (page: number) =>
      queryOptions({
        placeholderData: keepPreviousData,
        queryFn: async () => {
          const res = await client.api.referral.relations.$get({
            query: { page: String(page), pageSize: "20" },
          });
          if (!res.ok) {
            throw new Error("Failed to load relations");
          }
          return (await res.json()).data;
        },
        queryKey: referralKeys.relations(page),
      }),
  },
};
