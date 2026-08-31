import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { deLocalizeUrl, localizeUrl } from "@/paraglide/runtime.js";

import Loader from "./components/loader";
import { ErrorPage } from "./components/system/error";
import { NotFound } from "./components/system/not-found";
import { routeTree } from "./routeTree.gen";

function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        // 已有数据的后台刷新失败不再弹 toast：界面仍展示旧数据，逐次弹窗只会造成噪音。
        if (query.state.data !== undefined) {
          return;
        }
        // 不透传原始 error.message（可能泄漏内部实现/网络细节）；
        // 仅 DEV 环境保留原始信息便于排查。
        const message = import.meta.env.DEV ? error.message : m["common.error.message"]();
        toast.error(message, {
          action: {
            label: m["common.error.retry"](),
            onClick: () => {
              void query.invalidate();
            },
          },
        });
      },
    }),
    defaultOptions: { queries: { staleTime: 60 * 1000 } },
  });
}

export const getRouter = () => {
  const queryClient = createQueryClient();

  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    // Link 悬停/聚焦时预加载目标路由（intent）；配合 staleTime:0 让预加载的数据始终最新。
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    // Paraglide owns locale prefixes: incoming URLs are de-localized before
    // route matching (the route tree is locale-free) and outgoing hrefs are
    // re-localized, so links stay locale-agnostic and resolve to the active
    // locale automatically (R23.3, R23.4).
    rewrite: {
      input: ({ url }) => deLocalizeUrl(url),
      output: ({ url }) => localizeUrl(url),
    },
    defaultPendingComponent: () => <Loader />,
    defaultNotFoundComponent: () => <NotFound />,
    defaultErrorComponent: ({ error }) => <ErrorPage error={error} />,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  setupRouterSsrQueryIntegration({
    router,
    queryClient,
  });

  return router;
};

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
