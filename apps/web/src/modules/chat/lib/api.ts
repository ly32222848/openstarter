// Query 工厂：chat 模块（会话历史，Task 9）。
// 数据面经类型化 RPC（`client.api.llm.chats`）→ packages/api（requireAuth）。
//
// 历史分页语义（inf-page-params）：后端按 createdAt 倒序分页（page 1 = 最新一页），
// 页内再翻正序返回。useInfiniteQuery 从 page 1 向「更早」翻页，
// getNextPageParam 以「已加载条数 < total」判定还有更早消息，防止越界空转。

import { client } from "@/lib/api";

export const HISTORY_PAGE_SIZE = 100;

export type ChatMessageRow = {
  content: string;
  createdAt?: string;
  id: string;
  role: string;
};

type HistoryPage = {
  items: ChatMessageRow[];
  total: number;
};

export const chatKeys = {
  all: ["chat"] as const,
  history: (chatId: string) => ["ai", "chats", chatId, "messages"] as const,
};

/** 拉取历史的一页（page 1 = 最新一页）。供 useInfiniteQuery 的 queryFn 调用。 */
export async function fetchHistoryPage(chatId: string, page: number): Promise<HistoryPage> {
  const res = await client.api.llm.chats[":id"].messages.$get({
    param: { id: chatId },
    query: { page: String(page), pageSize: String(HISTORY_PAGE_SIZE) },
  });
  if (!res.ok) {
    throw new Error("Failed to load chat history");
  }
  const json = await res.json();
  if (!json.data) {
    throw new Error("Failed to load chat history");
  }
  return json.data as HistoryPage;
}

/**
 * 无限查询的翻页判定（getNextPageParam 契约：(lastPage, allPages, lastPageParam)）。
 * 累计已加载 < total 时存在更早页；lastPageParam 为已请求的最大页码，+1 即下一页。
 */
export function getNextHistoryPage(
  lastPage: HistoryPage,
  allPages: readonly HistoryPage[],
  lastPageParam: number,
): number | undefined {
  const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
  if (lastPage.items.length === 0 || loaded >= lastPage.total) {
    return undefined;
  }
  return lastPageParam + 1;
}

/** pages（新→旧）→ 时间正序的完整消息列表。 */
export function flattenHistoryPages(pages: readonly HistoryPage[]): ChatMessageRow[] {
  return [...pages].reverse().flatMap((page) => page.items);
}
