// 服务端产品目录 —— 结账金额/积分的唯一事实来源（security: server-side pricing）。
//
// POST /checkout 只接受 productId（及可选支付渠道），价格、货币、积分、订阅周期
// 全部从此目录解析。客户端传入的任何金额字段都会被服务端忽略，杜绝
// 「客户端改价」（0.01 元买 Pro）类漏洞。
//
// 维护约定：
//  - 与 apps/web/src/lib/marketing/pricing.ts 的展示价格保持一致（那边只是展示，
//    不参与定价）；新增产品先在这里登记，再改前端展示。
//  - amount 为最小货币单位（如「分」）。

/** 目录中的产品条目。 */
export interface ProductEntry {
  /** 价格（最小货币单位，如 2900 = $29.00）。 */
  amount: number;
  /** 订阅赠积分（可选）。 */
  credits?: number;
  /** 积分有效期（天，可选）。 */
  creditsValidDays?: number;
  /** 三字母小写货币代码。 */
  currency: string;
  /**
   * 商店商品 ID（可选）：App Store Connect 订阅产品 ID / Google Play
   * `<subscription_id>:<base_plan_id>`。RevenueCat webhook 按它反查目录，
   * 金额/积分仍以本目录为唯一事实来源。缺省表示未上架商店。
   */
  iapProductId?: string;
  /** 订阅周期单位（type=subscription 时必填）。 */
  interval?: "day" | "week" | "month" | "year";
  /** 订阅周期数（type=subscription 时可选，默认 1）。 */
  intervalCount?: number;
  /** 订阅计划展示名（type=subscription 时可选）。 */
  planName?: string;
  /** 产品 ID（客户端以此引用产品）。 */
  productId: string;
  /** 订单/账单展示名。 */
  productName: string;
  /** 结账类型：一次性购买或订阅。 */
  type: "one-time" | "subscription";
}

// TODO: replace with your own products（与前端展示价一致）。
export const PRODUCT_CATALOG: readonly ProductEntry[] = [
  {
    amount: 2900,
    credits: 50_000,
    currency: "usd",
    // App Store Connect 订阅产品 ID（与 productId 恒等；Google Play 为
    // "<subscription_id>:<base_plan_id>" 形态，同样填这里）。
    iapProductId: "pro_monthly",
    interval: "month",
    intervalCount: 1,
    planName: "Pro",
    productId: "pro_monthly",
    productName: "Pro",
    type: "subscription",
  },
];

/** 按 ID 索引，O(1) 解析。 */
const PRODUCT_INDEX: ReadonlyMap<string, ProductEntry> = new Map(
  PRODUCT_CATALOG.map((entry) => [entry.productId, entry]),
);

/** 按商店商品 ID 索引（仅登记了 iapProductId 的条目参与），O(1) 反查。 */
const IAP_PRODUCT_INDEX: ReadonlyMap<string, ProductEntry> = new Map(
  PRODUCT_CATALOG.flatMap((entry) =>
    entry.iapProductId ? [[entry.iapProductId, entry] as const] : [],
  ),
);

/** 解析产品；未知 productId 返回 undefined（由调用方转为 400）。 */
export function resolveProduct(productId: string): ProductEntry | undefined {
  return PRODUCT_INDEX.get(productId);
}

/** 按商店商品 ID（App Store / Google Play）反查产品；未登记返回 undefined。 */
export function resolveProductByIapId(iapProductId: string): ProductEntry | undefined {
  return IAP_PRODUCT_INDEX.get(iapProductId);
}
