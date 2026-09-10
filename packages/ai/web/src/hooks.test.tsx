// hooks 测试（Task 12）：QueryClient + renderHook，mock 全局 fetch，
// 断言 useAIModels 经 RPC 返回解包后的分组数据、queryKey 稳定、错误信封抛错。

import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAIClient, mutations, queries, setAIBaseUrl } from "./hooks";

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {children}
    </QueryClientProvider>
  );
}

const MODEL_CATALOG = {
  replicate: [
    {
      id: "m1",
      provider: "replicate",
      modelId: "black-forest-labs/flux-2-pro",
      displayName: "Flux 2 Pro",
      mediaType: "image",
      creditPrice: 5,
      maxOutputTokens: null,
      optionsSchema: null,
    },
  ],
};

/** 直接执行 queryOptions 产物的 queryFn（签名经 `as never` 吸收 query-core 泛型差异）。 */
async function runQuery(options: { queryFn?: unknown }): Promise<unknown> {
  const { queryFn } = options;
  if (typeof queryFn !== "function") {
    throw new Error("queryFn is required");
  }
  return (queryFn as (ctx: never) => Promise<unknown>)({} as never);
}

/**
 * 测试内 useQuery shim：把 queryOptions 产物按 queryKey/queryFn 挂上真实 useQuery，
 * 模拟 hook 消费路径；queryFn 签名以调用点 `as never` 吸收泛型差异。
 */
function useQueryShim<TData>(options: {
  queryKey: readonly unknown[];
  queryFn?: (ctx: never) => TData | Promise<TData>;
}) {
  return useQuery({
    queryKey: options.queryKey,
    queryFn: async () => {
      const fn = options.queryFn;
      if (!fn) {
        throw new Error("queryFn is required");
      }
      return (await fn({} as never)) as TData;
    },
  });
}

describe("ai-web hooks", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    setAIBaseUrl("/");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("models query returns the unwrapped grouped catalog", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, message: "", data: MODEL_CATALOG }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useQueryShim(queries.models()), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(MODEL_CATALOG);
    // queryKey 断言走独立 shim 返回值（useQueryResult 不暴露 queryKey）。
    expect(queries.models().queryKey).toEqual(["ai", "models"]);

    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("/api/ai/models");
  });

  it("tasks query narrows mediaType and skips invalid values", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ code: 0, message: "", data: { items: [], total: 0 } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await runQuery(queries.tasks({ mediaType: "image", page: 1 }));
    const [validUrl] = fetchMock.mock.calls[0] as [string];
    expect(validUrl).toContain("mediaType=image");

    await runQuery(queries.tasks({ mediaType: "bogus", page: 1 }));
    expect((fetchMock.mock.calls[1] as [string])[0]).not.toContain("mediaType");

    expect(queries.tasks({ mediaType: "image", page: 2 }).queryKey).toEqual([
      "ai",
      "tasks",
      "image",
      2,
    ]);
  });

  it("throws on non-2xx responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("unauthorized", { status: 401 })),
    );

    await expect(runQuery(queries.models())).rejects.toThrow("Failed to load AI models");
  });

  it("createChat unwraps the envelope", async () => {
    const created = { id: "chat-1", title: "hello" };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: 0, message: "", data: created }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const createChat = mutations.createChat().mutationFn;
    if (!createChat) {
      throw new Error("mutationFn is required");
    }
    const data = await createChat({ title: "hello" }, {} as never);
    expect(data).toEqual(created);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/llm/chats");
    expect(JSON.parse(String(init.body))).toEqual({ title: "hello" });
  });

  it("setAIBaseUrl rebuilds the module client with the new base", () => {
    setAIBaseUrl("https://desktop.example.com");
    expect(getAIClient()).toBeDefined();
    setAIBaseUrl("/");
  });
});
