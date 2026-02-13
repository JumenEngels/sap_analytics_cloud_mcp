/**
 * Provider factory — instantiates the right LLM provider based on config.
 */

export type { LlmProvider, LlmResponse, ToolCall, ToolCallResult, McpToolDef, ProviderConfig } from "./types.js";

import type { LlmProvider, ProviderConfig } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { SAPAICoreProvider } from "./genaicore.js";

export function createProvider(config: ProviderConfig): LlmProvider {
  switch (config.provider) {
    case "anthropic":
      return new AnthropicProvider(config);
    case "openai":
      return new OpenAIProvider(config);
    case "gemini":
      return new GeminiProvider(config);
    case "genaicore":
      return new SAPAICoreProvider(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}
