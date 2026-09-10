// packages/ai/web/client —— 类型化 AI RPC 客户端工厂（Task 12）。
//
// 内部 `hc<AppType>(baseUrl)`：类型级依赖 @openstarter/api（`import type`，不引入运行时），
// `hc` 运行时来自 hono/client。web 端可直接复用 apps/web/src/lib/api.ts 的单例；
// desktop/extension 等端经 `createAIClient(baseUrl)` 注入各自 baseUrl。

import { hc } from "hono/client";

import type { AppType } from "@openstarter/api";

/**
 * 创建类型化 AI RPC 客户端（包级工厂）：`hc<AppType>(baseUrl)`。
 * baseUrl 须以协议或 "/" 结尾由调用方保证（hc 语义：相对路径基于当前 origin）。
 */
export function createAIClient(baseUrl: string) {
  return hc<AppType>(baseUrl);
}
