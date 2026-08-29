// Mutation 工厂：checkout 模块（R10）
// 经类型化 Hono RPC 客户端发起结账。

import { mutationOptions } from "@tanstack/react-query";

import { client } from "@/lib/api";

import type { PricingCheckout } from "@/lib/marketing/pricing";

const mutations = {
  create: () =>
    mutationOptions({
      // 只上送 productId：价格/货币/积分由服务端产品目录决定（server-side pricing），
      // 客户端不传任何金额字段。PricingCheckout 里的其余字段仅用于本地展示。
      mutationFn: async (input: Pick<PricingCheckout, "productId">) => {
        const res = await client.api.checkout.$post({
          json: { productId: input.productId },
        });
        const json = await res.json();
        if ("code" in json && json.code === 0 && json.data) {
          return json.data as {
            checkoutUrl?: string;
            orderNo?: string;
            qrData?: { amount: number; codeUrl: string };
          };
        }
        const message =
          "message" in json && typeof json.message === "string" ? json.message : "Checkout failed";
        throw new Error(message);
      },
    }),
};

export const checkout = { mutations } as const;
