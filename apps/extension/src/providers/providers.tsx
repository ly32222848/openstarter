import { AuthStateProvider } from "../lib/auth-state";
import { QueryClientProvider } from "../lib/query";
import { ApiClientProvider } from "../lib/api-context";
import type { ReactNode } from "react";
import type { createExtensionApiClient } from "../lib/api";
import type { createExtensionAuthClient } from "../lib/auth-client";

type Api = ReturnType<typeof createExtensionApiClient>;
type Auth = ReturnType<typeof createExtensionAuthClient>;

interface AppProvidersProps {
  children: ReactNode;
  value: { api: Api; auth: Auth };
}

// 插件端 Provider 链。i18n 无 Provider：语言跟随浏览器 UI 语言，由 @wxt-dev/i18n
// 生成的 #i18n（browser.i18n 同步 API）直接取译文，不再有异步 locale 探测。
export function AppProviders({ children, value }: AppProvidersProps) {
  return (
    <AuthStateProvider>
      <ApiClientProvider value={value}>
        <QueryClientProvider>{children}</QueryClientProvider>
      </ApiClientProvider>
    </AuthStateProvider>
  );
}
