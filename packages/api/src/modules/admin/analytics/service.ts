// packages/api/src/analytics/service —— 站点分析服务（Analytics_Service，R25）。
//
// 两类职责：
//   1. 后台汇总指标（R25.3）：`getAdminMetrics` 对相关表做聚合计数/求和，返回用户数、订单数、
//      订阅数与积分消耗，供 Admin 首页概览（任务 33.3）经管理员路由消费。
//   2. 公开分析配置（R25.1/R25.2 数据面）：`getPublicAnalyticsConfig` 从 Config 读取分析供应商
//      标识与度量 ID（**仅**分析相关的非敏感项），供 apps/web 的 `__root.tsx` 依据其条件注入
//      对应采集脚本。分析度量 ID 本就随页面 HTML 公开，故经公开只读端点下发不涉密。
//
// 数据访问统一走 `@openstarter/db`（`db()` 单例 + `@openstarter/db/schema` 表定义），跨方言一致；
// 积分口径复用 `@openstarter/billing` 的领域常量（CONSUME / ACTIVE），避免魔法字符串并与积分域
// 单一事实源保持一致。Config 读取走 `@openstarter/shared/config`（env + DB 双源合并、秘密解密、
// 1h 缓存）。依赖分层 api → db / shared / billing，无反向、无环。

import { CreditStatus, CreditTransactionType } from "@openstarter/billing-web/credits";
import { credit, order, subscription, user } from "@openstarter/db/schema";
import { db } from "@openstarter/db/server";
import { getAllConfigs } from "@openstarter/shared/config";
import { and, count, eq, sum } from "drizzle-orm";

/**
 * 后台汇总指标（R25.3）。
 * - `userCount` / `orderCount` / `subscriptionCount`：对应表的总行数（与 Admin 各实体列表的
 *   计数口径一致——不额外过滤软删，反映平台累计规模）。
 * - `creditsConsumed`：已消耗积分总量（正数）——对 `transaction_type='consume'` 且
 *   `status='active'` 的流水求和；已撤销的消费（`status='deleted'`）不计入，故为**净消耗**。
 */
export interface AdminMetrics {
  creditsConsumed: number;
  orderCount: number;
  subscriptionCount: number;
  userCount: number;
}

/**
 * 公开分析配置（R25.1/R25.2 数据面 + 移动端扩展）：仅含分析供应商标识与
 * 度量 ID（非敏感）。空字符串表示未配置该供应商——apps/web 据此决定是否注入
 * 对应脚本，apps/mobile 据此决定是否初始化对应 SDK。
 *
 * 移动端三键的设计决策（spec §6）：openpanel_client_secret 经公开端点下发是
 * **有意的** —— 官方 RN SDK 即要求 clientSecret 进客户端（认证用），暴露面与
 * 打进 app bundle 等价；该 secret 可在 OpenPanel 面板随时轮换。
 */
export interface PublicAnalyticsConfig {
  gaMobileEnabled: boolean;
  googleAnalyticsId: string;
  openpanelClientId: string;
  openpanelClientSecret: string;
  plausibleDomain: string;
  plausibleSrc: string;
}

/** 将 `count()` 结果（可能缺失）归一为非负整数。 */
function toCount(value: number | undefined): number {
  return value ?? 0;
}

/**
 * 将消费流水 `SUM(credits)` 的返回（`string | null`）归一为「已消耗积分总量」。
 * 消费流水的 `credits` 存为负值（`-amount`，见 Credit_Service.consume），故取绝对值。
 */
function toConsumedTotal(total: string | null | undefined): number {
  return total ? Math.abs(Number.parseInt(total, 10)) : 0;
}

/**
 * 汇总后台关键指标（R25.3）：用户数、订单数、订阅数与积分消耗。
 * 四项聚合互不依赖，经 `Promise.all` 并行执行。
 */
export async function getAdminMetrics(): Promise<AdminMetrics> {
  const database = db();
  const [userRows, orderRows, subscriptionRows, consumedRows] = await Promise.all([
    database.select({ value: count() }).from(user),
    database.select({ value: count() }).from(order),
    database.select({ value: count() }).from(subscription),
    database
      .select({ total: sum(credit.credits) })
      .from(credit)
      .where(
        and(
          eq(credit.transactionType, CreditTransactionType.CONSUME),
          eq(credit.status, CreditStatus.ACTIVE),
        ),
      ),
  ]);

  return {
    creditsConsumed: toConsumedTotal(consumedRows[0]?.total),
    orderCount: toCount(orderRows[0]?.value),
    subscriptionCount: toCount(subscriptionRows[0]?.value),
    userCount: toCount(userRows[0]?.value),
  };
}

/**
 * 读取公开分析配置：从 Config 取分析供应商标识与度量 ID，去空白后返回；
 * 未配置项为空字符串。**绝不**下发其它（含敏感）配置项——仅白名单内的分析键。
 * `ga_mobile_enabled` 严格 `=== "true"`（与开关语义一致），映射为 boolean。
 */
export async function getPublicAnalyticsConfig(): Promise<PublicAnalyticsConfig> {
  const configs = await getAllConfigs();
  return {
    gaMobileEnabled: configs.ga_mobile_enabled === "true",
    googleAnalyticsId: configs.google_analytics_id?.trim() ?? "",
    openpanelClientId: configs.openpanel_client_id?.trim() ?? "",
    openpanelClientSecret: configs.openpanel_client_secret?.trim() ?? "",
    plausibleDomain: configs.plausible_domain?.trim() ?? "",
    plausibleSrc: configs.plausible_src?.trim() ?? "",
  };
}
