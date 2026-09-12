// Query 工厂：ai 模块（模型目录 / 聊天会话 / 生成任务）。
// 自 Task 12 起逻辑下沉至 @openstarter/ai-web（跨端复用层），此处 re-export 保持调用点不变。
// 数据面经类型化 RPC（`client.api.ai.models` / `client.api.llm.chats` / `client.api["ai-tasks"]`）→ packages/api。
// web 端默认相对根路径（hc 单例基址 "/"）；desktop/extension 经 `setAIBaseUrl` 注入各自 baseUrl。

export {
  ai,
  aiKeys,
  mutations,
  queries,
  setAIBaseUrl,
  type AiModelView,
} from "@openstarter/ai-web";
