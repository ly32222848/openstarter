/**
 * LLM provider resolution — resolves model instances via Vercel AI SDK
 * based on application configuration keys.
 *
 * 供应商配置键统一为双引擎共用的 `openai_api_key` 等（不再使用 `llm_*` 前缀），
 * 修复旧实现读取未注册键导致聊天永远不可用的缺陷。OpenRouter/DeepSeek/Ollama
 * 均为 OpenAI 兼容端点，经 `createOpenAICompatible` 按 baseURL 装配。
 */

import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { getAllConfigs } from "@openstarter/shared/config";
import { logger } from "@openstarter/shared/logger";
import type { LanguageModel } from "ai";

const OLLAMA_PLACEHOLDER_KEY = "ollama";

/** OpenAI 兼容渠道清单：baseURL 配置键 → 供应商名。 */
const OPENAI_COMPATIBLE_PROVIDERS = {
  openrouter: { baseURLKey: "openrouter_base_url", defaultBaseURL: "https://openrouter.ai/api/v1" },
  deepseek: { baseURLKey: "deepseek_base_url", defaultBaseURL: "https://api.deepseek.com/v1" },
  ollama: { baseURLKey: "ollama_base_url", defaultBaseURL: "http://localhost:11434/v1" },
} as const;

export type OpenAICompatibleProviderName = keyof typeof OPENAI_COMPATIBLE_PROVIDERS;

function isOpenAICompatibleProvider(name: string): name is OpenAICompatibleProviderName {
  return name in OPENAI_COMPATIBLE_PROVIDERS;
}

/**
 * Resolve an LLM model instance from config (provider + model name).
 * Throws if the provider is unconfigured or unknown.
 */
export async function getModel(provider?: string, modelId?: string): Promise<LanguageModel> {
  const configs = await getAllConfigs();

  const providerName = provider || configs.default_llm_provider || "openai";
  const model = modelId || "gpt-4o-mini";

  switch (providerName) {
    case "openai": {
      if (!configs.openai_api_key) {
        throw new Error("OpenAI API key not configured (openai_api_key)");
      }
      logger.debug(`[llm] Loading OpenAI model: ${model}`);
      return openai.chat(model);
    }
    case "anthropic": {
      if (!configs.anthropic_api_key) {
        throw new Error("Anthropic API key not configured (anthropic_api_key)");
      }
      logger.debug(`[llm] Loading Anthropic model: ${model}`);
      return anthropic(model);
    }
    case "google": {
      if (!configs.google_api_key) {
        throw new Error("Google API key not configured (google_api_key)");
      }
      logger.debug(`[llm] Loading Google model: ${model}`);
      return google(model);
    }
    default: {
      if (!isOpenAICompatibleProvider(providerName)) {
        throw new Error(`Unknown LLM provider: ${providerName}`);
      }
      const { baseURLKey, defaultBaseURL } = OPENAI_COMPATIBLE_PROVIDERS[providerName];
      if (providerName === "ollama" && !configs.ollama_base_url && !configs[baseURLKey]) {
        throw new Error("Ollama base URL not configured (ollama_base_url)");
      }
      const apiKey =
        providerName === "ollama"
          ? OLLAMA_PLACEHOLDER_KEY
          : configs[`${providerName}_api_key`] || "";
      if (providerName !== "ollama" && !apiKey) {
        throw new Error(`${providerName} API key not configured (${providerName}_api_key)`);
      }
      logger.debug(`[llm] Loading ${providerName} model: ${model}`);
      const compatible = createOpenAICompatible({
        name: providerName,
        baseURL: configs[baseURLKey] || defaultBaseURL,
        apiKey,
      });
      return compatible(model);
    }
  }
}

/**
 * Check if LLM chat is globally enabled.
 */
export async function isLLMEnabled(): Promise<boolean> {
  const configs = await getAllConfigs();
  return configs.llm_enabled !== "false";
}

/**
 * Return list of configured providers (those with credentials).
 * Ollama 无凭证，以 baseURL 是否配置判定。
 */
export async function getAvailableProviders(): Promise<string[]> {
  const configs = await getAllConfigs();
  const providers: string[] = [];

  if (configs.openai_api_key) providers.push("openai");
  if (configs.anthropic_api_key) providers.push("anthropic");
  if (configs.google_api_key) providers.push("google");
  if (configs.openrouter_api_key) providers.push("openrouter");
  if (configs.deepseek_api_key) providers.push("deepseek");
  if (configs.ollama_base_url) providers.push("ollama");

  return providers;
}
