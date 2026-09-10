// 消息流渲染（Task 9）：从 useChat 的 UIMessage[] 渲染文本部分。
// 仅消费 text parts（当前后端只存纯文本），其他 part 类型后续按需扩展。

import type { UIMessage } from "ai";

const ChatMessageBubble = ({ message }: { message: UIMessage }) => {
  const isUser = message.role === "user";
  const text = message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");

  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            : "max-w-[80%] rounded-lg border bg-muted/40 px-4 py-2"
        }
      >
        <div className="mb-0.5 font-medium text-xs opacity-70">{isUser ? "You" : "Assistant"}</div>
        <p className="whitespace-pre-wrap text-sm">{text}</p>
      </div>
    </div>
  );
};

export function ChatMessages({ messages }: { messages: UIMessage[] }) {
  if (messages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}
    </div>
  );
}
