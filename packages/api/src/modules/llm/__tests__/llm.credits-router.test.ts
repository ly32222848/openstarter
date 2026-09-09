/**
 * LLM credits router tests — chat message streaming with credit preload/settle.
 *
 * 沿用 ai-catalog/router.test.ts 的 harness：requireAuth 走 x-test-user-id header
 * mock，plan-gate 透传；`./credits` 的 preload/settle mock 为 vi.fn（计费语义由
 * credits.test.ts 覆盖，此处聚焦路由接线：预扣 402 短路、成功路径参数透传）。
 * `./provider` 的 getModel mock 返回哨兵对象，避免真实 AI SDK 装配。数据库沿用
 * llm.test.ts 的 in-memory SQLite harness（chat / chat_message 真表）。
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { sql } from "drizzle-orm";
import type { Database } from "@openstarter/db";
import { createDb } from "@openstarter/db";

const state = vi.hoisted(() => ({
  database: undefined as Database | undefined,
  preloadChatCredits: vi.fn(),
  settleChatCredits: vi.fn(),
  getModel: vi.fn(),
  streamText: vi.fn(),
}));

// streamText mock：返回带 text/event-stream 头的 Response，并同步触发 onFinish
// （携带 usage.totalTokens），使路由的 settle 接线可被断言。
vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>();
  return {
    ...actual,
    streamText: state.streamText,
  };
});

vi.mock("@openstarter/db/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@openstarter/db/server")>();
  return {
    ...actual,
    db: () => {
      if (!state.database) {
        throw new Error("llm credits router test database not initialized");
      }
      return state.database;
    },
  };
});

vi.mock("@openstarter/auth", () => ({
  getUserPlan: vi.fn(),
}));

vi.mock("@openstarter/auth/server", () => ({
  createAuth: vi.fn(() => ({ api: { getSession: vi.fn(async () => null) } })),
}));

vi.mock("@openstarter/auth/apikeys/service", () => ({
  validateApiKey: vi.fn(async () => null),
}));

// ../../middleware/auth：从 x-test-user-id header 注入 userId，不做真实鉴权
// （notes.test.ts 同款；导出形状与真实 auth.ts 一致：apiKeyAuth/authMiddleware/requireAuth）。
vi.mock("../../../middleware/auth", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware<{ Variables: { session: null } }>(async (_c, next) => {
    await next();
  });
  const requireAuth = createMiddleware<{
    Variables: { userId: string; session: null };
  }>(async (c, next) => {
    c.set("session", null);
    c.set("userId", c.req.header("x-test-user-id") ?? "test-user");
    await next();
  });
  return { apiKeyAuth: requireAuth, authMiddleware: passthrough, requireAuth };
});

vi.mock("../../../middleware/plan-gate", async () => {
  const { createMiddleware } = await import("hono/factory");
  const passthrough = createMiddleware(async (_c, next) => {
    await next();
  });
  return { requirePlan: () => passthrough };
});

vi.mock("../credits", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../credits")>();
  return {
    ...actual,
    preloadChatCredits: state.preloadChatCredits,
    settleChatCredits: state.settleChatCredits,
  };
});

// ./provider：getModel 返回哨兵对象；isLLMEnabled 恒 true。
vi.mock("../provider", () => ({
  getModel: state.getModel,
  isLLMEnabled: () => Promise.resolve(true),
}));

import { createChat, createMessage } from "../service";
import { llmRouter } from "../router";
import { InsufficientCreditsError } from "../../ai-tasks/service";

/** streamText mock 默认行为：返回 SSE Response（onFinish 由测试按需手动触发）。 */
function defaultStreamText() {
  return {
    toUIMessageStreamResponse: () =>
      new Response(null, { status: 200, headers: { "content-type": "text/event-stream" } }),
  };
}

const NOW_MS = "(cast((julianday('now') - 2440587.5)*86400000 as integer))";

const CREATE_CHAT = `CREATE TABLE chat (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  content TEXT,
  metadata TEXT,
  model TEXT NOT NULL,
  parts TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS}
)`;

const CREATE_CHAT_MESSAGE = `CREATE TABLE chat_message (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chat(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  parts TEXT NOT NULL,
  metadata TEXT,
  model TEXT NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT ${NOW_MS},
  updated_at INTEGER NOT NULL DEFAULT ${NOW_MS}
)`;

const TEST_USER_ID = "test-user-llm-credits";
const SENTINEL_MODEL = { modelId: "sentinel-gpt" } as never;

let dbPath: string | undefined;

beforeAll(async () => {
  const tmpDir = await import("node:os").then((os) => os.tmpdir());
  const { join } = await import("node:path");
  dbPath = join(tmpDir, `llm-credits-router-test-${Date.now()}.db`);

  const database = createDb({
    provider: "sqlite",
    url: `file://${dbPath}`,
    singleton: false,
  });

  await database.run(sql.raw(CREATE_CHAT));
  await database.run(sql.raw(CREATE_CHAT_MESSAGE));

  state.database = database;
});

afterAll(() => {
  if (dbPath) {
    import("node:fs").then((fs) => fs.rmSync(dbPath!, { force: true }));
  }
  state.database = undefined;
});

function sendMessage(path: string, init: RequestInit = {}) {
  return llmRouter.request(path, {
    ...init,
    headers: { ...(init.headers ?? {}), "x-test-user-id": TEST_USER_ID },
  });
}

function jsonInit(body: unknown): RequestInit {
  return {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  };
}

async function seedChatWithHistory(): Promise<string> {
  const created = await createChat({
    userId: TEST_USER_ID,
    provider: "openai",
    model: "gpt-4o-mini",
  });
  const chatId = created.id as string;
  await createMessage({
    chatId,
    userId: TEST_USER_ID,
    role: "user",
    content: "hello from history",
  });
  return chatId;
}

describe("POST /llm/chats/:id/messages — credit wiring", () => {
  beforeEach(() => {
    state.streamText.mockClear();
    state.settleChatCredits.mockReset();
    state.preloadChatCredits.mockReset();
  });

  it("returns 402 and persists no user message when preload throws InsufficientCreditsError", async () => {
    const chatId = await seedChatWithHistory();
    state.getModel.mockResolvedValue(SENTINEL_MODEL);
    state.preloadChatCredits.mockRejectedValue(new InsufficientCreditsError());

    const response = await sendMessage(
      `/llm/chats/${chatId}/messages`,
      jsonInit({ content: "hi" }),
    );

    expect(response.status).toBe(402);
    const body = (await response.json()) as { code: number; message: string; data: unknown };
    expect(body.message).toBe("insufficient credits");
    // respErr 不携带 data 字段（ApiResponse.data 可选，失败时省略）。
    expect(body.data).toBeUndefined();

    // 预扣失败必须短路在 user 消息落库之前 —— 历史仅含 seed 的 1 条。
    const history = await state.database
      ?.select()
      .from((await import("@openstarter/db/schema")).chatMessage);
    const userRows = (history ?? []).filter((m) => m.chatId === chatId);
    expect(userRows).toHaveLength(1);
    expect(state.settleChatCredits).not.toHaveBeenCalled();
    expect(state.streamText).not.toHaveBeenCalled();
  });

  it("streams and forwards preload args (userId, chatId, provider, model, historyChars) on success", async () => {
    const chatId = await seedChatWithHistory();
    state.getModel.mockResolvedValue(SENTINEL_MODEL);
    state.streamText.mockImplementation(defaultStreamText);
    state.preloadChatCredits.mockResolvedValue({
      consumedCreditId: "c1",
      estimatedCost: 5,
      maxOutputTokens: 4096,
    });

    const response = await sendMessage(
      `/llm/chats/${chatId}/messages`,
      jsonInit({ content: "hi" }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    expect(state.preloadChatCredits).toHaveBeenCalledTimes(1);
    expect(state.preloadChatCredits).toHaveBeenCalledWith({
      userId: TEST_USER_ID,
      chatId,
      provider: "openai",
      model: "gpt-4o-mini",
      historyChars: expect.any(Number),
    });

    // user 消息在预扣成功后落库。
    const history = await state.database
      ?.select()
      .from((await import("@openstarter/db/schema")).chatMessage);
    const userRows = (history ?? []).filter((m) => m.chatId === chatId && m.role === "user");
    expect(userRows).toHaveLength(2);
  });

  it("passes maxOutputTokens from preload to streamText and settles credits in onFinish", async () => {
    const chatId = await seedChatWithHistory();
    state.getModel.mockResolvedValue(SENTINEL_MODEL);
    state.streamText.mockImplementation(defaultStreamText);
    state.preloadChatCredits.mockResolvedValue({
      consumedCreditId: "c2",
      estimatedCost: 9,
      maxOutputTokens: 2048,
    });

    await sendMessage(`/llm/chats/${chatId}/messages`, jsonInit({ content: "hi" }));

    // 输出封顶透传给 streamText（目录值优先）。
    expect(state.streamText).toHaveBeenCalledTimes(1);
    const streamArgs = state.streamText.mock.calls[0]?.[0] as {
      maxOutputTokens?: number;
      onFinish?: (event: { text: string; usage: { totalTokens: number } }) => Promise<void> | void;
    };
    expect(streamArgs.maxOutputTokens).toBe(2048);

    // onFinish 冲账：整包透传预扣归属 + 实际用量（真实 onFinish 由 AI SDK 在流末触发，
    // 这里手动调用来断言透传参数与冲账行为）。
    await streamArgs.onFinish?.({ text: "mock reply", usage: { totalTokens: 1234 } });
    expect(state.settleChatCredits).toHaveBeenCalledTimes(1);
    expect(state.settleChatCredits).toHaveBeenCalledWith({
      consumedCreditId: "c2",
      estimatedCost: 9,
      totalTokens: 1234,
      provider: "openai",
      model: "gpt-4o-mini",
    });

    // 冲账失败不得向已完成的流抛错（仅 warn，流已 200）。
    state.settleChatCredits.mockRejectedValueOnce(new Error("settle boom"));
    const chatId2 = await seedChatWithHistory();
    state.preloadChatCredits.mockResolvedValue({
      consumedCreditId: "c3",
      estimatedCost: 1,
      maxOutputTokens: 4096,
    });
    const response2 = await sendMessage(
      `/llm/chats/${chatId2}/messages`,
      jsonInit({ content: "hi" }),
    );
    expect(response2.status).toBe(200);
  });
});
