// 聊天页（Task 9）：左侧会话列表 + 模型选择，右侧消息流 + 输入区。
// useChat（@ai-sdk/react 3.x）经 DefaultChatTransport 接到
// POST /api/llm/chats/:id/messages（SSE UIMessage 流）；历史经
// GET /api/llm/chats/:id/messages 拉取后映射为 UIMessage[] 注入 setMessages。

import { Button } from "@openstarter/ui-web/components/button";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
// DefaultChatTransport 仅由 `ai` 包导出（@ai-sdk/react 3.x 内部自 `ai` 引入但不转发）。
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstarter/ui-web/components/select";
import { Textarea } from "@openstarter/ui-web/components/textarea";

import { ai, type AiModelView } from "@/modules/ai/lib/api";
import { client } from "@/lib/api";

import { ChatMessages } from "./chat-messages";

const HISTORY_PAGE_SIZE = 100;

type ChatRow = {
  id: string;
  title: string;
  updatedAt?: string;
};

const modelKey = (model: { provider: string; modelId: string }): string =>
  `${model.provider}:${model.modelId}`;

/** 模型选择器的可选项：text 分组 + `${provider}:${modelId}` 键。 */
const selectorItems = (models: AiModelView[]) =>
  models.map((model) => ({ key: modelKey(model), label: model.displayName }));

/** 历史 API 行（纯文本 content）→ UIMessage。 */
const toUiMessage = (row: { id: string; role: string; content: string }): UIMessage => ({
  id: row.id,
  role: row.role === "assistant" ? "assistant" : "user",
  parts: [{ type: "text", text: row.content }],
});

export function ChatPage() {
  const modelsQuery = useQuery({ ...ai.queries.models() });
  const chatsQuery = useQuery({ ...ai.queries.chats(1) });

  const createChat = useMutation({ ...ai.mutations.createChat() });
  const deleteChat = useMutation({ ...ai.mutations.deleteChat() });

  const textModels: AiModelView[] = modelsQuery.data?.text ?? [];
  const modelOptions = selectorItems(textModels);

  const [selectedModelKey, setSelectedModelKey] = useState<string | null>(null);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  // 默认选中 text 分组的第一个模型；用户显式选择后以选择为准。
  const activeModelKey = selectedModelKey ?? modelOptions.at(0)?.key ?? "";

  const handleModelChange = (key: string) => {
    setSelectedModelKey(key);
  };

  // 模型键解析：modelId 本身可能含 ":"（openrouter 风格），只在首个 ":" 处
  // 切分 provider 与 modelId（final-review MINOR-6）。
  const parseModelKey = (key: string): { modelId: string; provider: string } | null => {
    const index = key.indexOf(":");
    if (index <= 0 || index === key.length - 1) {
      return null;
    }
    return { provider: key.slice(0, index), modelId: key.slice(index + 1) };
  };

  const handleNewChat = async () => {
    const parsed = parseModelKey(activeModelKey);
    try {
      const created = await createChat.mutateAsync(
        parsed ? { provider: parsed.provider, model: parsed.modelId } : {},
      );
      // RPC 信封 data 未携带精确类型，边界处校验后再使用。
      const newChatId = created?.id;
      if (typeof newChatId !== "string") {
        throw new Error("Failed to create chat");
      }
      setActiveChatId(newChatId);
      toast.success("New chat created");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteChat.mutateAsync({ id });
      if (activeChatId === id) {
        setActiveChatId(null);
      }
      toast.success("Chat deleted");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const chats = (chatsQuery.data?.items ?? []) as ChatRow[];

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-6xl gap-6">
      <aside className="flex w-64 shrink-0 flex-col gap-3">
        <Select onValueChange={handleModelChange} value={activeModelKey}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a model..." />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((option) => (
              <SelectItem key={option.key} value={option.key}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button disabled={createChat.isPending} onClick={() => void handleNewChat()} type="button">
          New chat
        </Button>

        <div className="flex-1 divide-y overflow-y-auto rounded-lg border">
          {chats.map((chat) => (
            <div className="flex items-center justify-between gap-1 px-3 py-2" key={chat.id}>
              <button
                className="min-w-0 flex-1 text-left hover:bg-muted/60"
                onClick={() => setActiveChatId(chat.id)}
                type="button"
              >
                <span className="block truncate font-medium text-sm">
                  {chat.title || "Untitled"}
                </span>
              </button>
              <Button
                aria-label={`Delete ${chat.title || "Untitled"}`}
                disabled={deleteChat.isPending}
                onClick={() => void handleDeleteChat(chat.id)}
                size="sm"
                type="button"
                variant="ghost"
              >
                Delete
              </Button>
            </div>
          ))}
          {chatsQuery.isPending ? (
            <p className="p-3 text-muted-foreground text-sm">Loading chats...</p>
          ) : null}
          {!chatsQuery.isPending && chats.length === 0 ? (
            <p className="p-3 text-muted-foreground text-sm">No chats yet.</p>
          ) : null}
        </div>
      </aside>

      {activeChatId === null ? (
        <section className="flex flex-1 items-center justify-center rounded-lg border">
          <p className="text-muted-foreground text-sm">
            Select a conversation or start a new chat.
          </p>
        </section>
      ) : (
        <ChatSurface chatId={activeChatId} draft={draft} onDraftChange={setDraft} />
      )}
    </div>
  );
}

/** 历史查询 key（与下方 historyQuery 一致）：流式结束后据此失效缓存。 */
const historyKey = (chatId: string) => ["ai", "chats", chatId, "messages"] as const;

function ChatSurface({
  chatId,
  draft,
  onDraftChange,
}: {
  chatId: string;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const queryClient = useQueryClient();
  const { messages, sendMessage, status, error, setMessages, stop, clearError } = useChat({
    id: chatId,
    onError: (streamError: Error) => toast.error(streamError.message),
    transport: new DefaultChatTransport({ api: `/api/llm/chats/${chatId}/messages` }),
    // 流式结束（含 abort）即失效历史缓存：全局 staleTime 60s 会让刚落库的
    // 消息在切换会话/重挂载时被旧缓存遮蔽（final-review MEDIUM-2）。
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: historyKey(chatId) });
    },
  });

  const historyQuery = useQuery({
    queryFn: async () => {
      const res = await client.api.llm.chats[":id"].messages.$get({
        param: { id: chatId },
        query: { page: "1", pageSize: String(HISTORY_PAGE_SIZE) },
      });
      if (!res.ok) {
        throw new Error("Failed to load chat history");
      }
      const json = await res.json();
      if (!json.data) {
        throw new Error("Failed to load chat history");
      }
      return json.data.items as Array<{ id: string; role: string; content: string }>;
    },
    queryKey: historyKey(chatId),
  });

  useEffect(() => {
    if (historyQuery.data) {
      setMessages(historyQuery.data.map(toUiMessage));
    }
  }, [historyQuery.data, setMessages]);

  const isStreaming = status === "streaming" || status === "submitted";

  const handleSubmit = () => {
    const text = draft.trim();
    if (text.length === 0 || isStreaming) {
      return;
    }
    void sendMessage({ text });
    onDraftChange("");
  };

  return (
    <section className="flex flex-1 flex-col gap-3 rounded-lg border p-4" key={chatId}>
      <div className="flex-1 overflow-y-auto">
        <ChatMessages messages={messages} />
      </div>

      {error ? (
        <div
          className="flex items-center justify-between gap-2 rounded-lg border border-destructive bg-card px-4 py-3 text-destructive text-sm"
          role="alert"
        >
          <span>{error.message}</span>
          <Button onClick={clearError} size="sm" type="button" variant="ghost">
            Dismiss
          </Button>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <Textarea
          disabled={isStreaming}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Type a message..."
          rows={2}
          value={draft}
        />
        {isStreaming ? (
          <Button onClick={() => void stop()} type="button" variant="outline">
            Stop
          </Button>
        ) : (
          <Button disabled={draft.trim().length === 0} onClick={handleSubmit} type="button">
            Send
          </Button>
        )}
      </div>
    </section>
  );
}
