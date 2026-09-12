// 路由 loader 的 intent 预取助手（defaultPreload: "intent" 配套）。
//
// 契约（routes/-preload-loaders.test.tsx 回归覆盖）：
// - 预取失败绝不打断导航：预取是锦上添花，错误由页面组件挂载后的内联 error 态呈现；
//   prefetchQuery 本身不抛（内部 swallow），故 Promise.allSettled 只是纵深防御。
// - 预取与组件消费同一 queryKey：直接传 modules/*/lib/api 的 queryOptions 工厂产物。
// - search 经 loaderDeps 中转（loader context 不提供 search，官方要求用 loaderDeps
//   显式声明依赖）：URL 分页参数变化 → deps 变化 → loader 重跑并预取新页。
//   页面路由配套写 `loaderDeps: ({ search }) => search`。

import type { QueryClient } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";

type LoaderFn = NonNullable<AnyRoute["options"]>["loader"];

/**
 * 返回一个可用作路由 `loader` 的函数：按 loaderDeps 透传的 URL 参数并行预取一组 query。
 *
 * @param factory 接收 loaderDeps（通常是整份 search 的透传），返回要预取的
 *                queryOptions 列表；返回空数组则跳过（不发请求）。
 */
export function preloadQueries(
  factory: (deps: Record<string, unknown>) => readonly unknown[],
): LoaderFn {
  return (async ({
    context,
    deps,
  }: {
    context: { queryClient: QueryClient };
    deps?: Record<string, unknown>;
  }) => {
    const targets = factory(deps ?? {});
    if (targets.length === 0) {
      return;
    }
    // 并行预取；单个失败静默（QueryCache.onError 已对无 observer 的预取豁免 toast）。
    await Promise.allSettled(
      targets.map((target) => context.queryClient.prefetchQuery(target as never)),
    );
  }) as LoaderFn;
}
