/**
 * Anthropic (Claude) LLM provider.
 */

import Anthropic from "@anthropic-ai/sdk";
import type {
  MessageParam,
  ContentBlockParam,
  ToolUseBlock,
  TextBlock,
} from "@anthropic-ai/sdk/resources/messages.js";
import type { LlmProvider, LlmResponse, ToolCallResult, ProviderConfig } from "./types.js";

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;
  private model: string;
  private system: string;
  private tools: Anthropic.Messages.Tool[];
  private messages: MessageParam[] = [];

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
    this.model = config.model;
    this.system = config.systemPrompt;
    this.tools = config.tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Messages.Tool["input_schema"],
    }));
  }

  async startTurn(userInput: string): Promise<LlmResponse> {
    this.messages.push({ role: "user", content: userInput });
    return this.callApi();
  }

  async continueTurn(results: ToolCallResult[]): Promise<LlmResponse> {
    this.messages.push({
      role: "user",
      content: results.map((r) => ({
        type: "tool_result" as const,
        tool_use_id: r.id,
        content: r.content,
        ...(r.isError ? { is_error: true as const } : {}),
      })) as ContentBlockParam[],
    });
    return this.callApi();
  }

  private async callApi(): Promise<LlmResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: this.system,
      tools: this.tools,
      messages: this.messages,
    });

    this.messages.push({ role: "assistant", content: response.content });

    const usage = { totalTokens: response.usage.input_tokens + response.usage.output_tokens };

    if (response.stop_reason === "tool_use") {
      const toolCalls = response.content
        .filter((b): b is ToolUseBlock => b.type === "tool_use")
        .map((b) => ({
          id: b.id,
          name: b.name,
          args: (b.input ?? {}) as Record<string, unknown>,
        }));
      return { done: false, text: "", toolCalls, usage };
    }

    const text = response.content
      .filter((b): b is TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return { done: true, text, toolCalls: [], usage };
  }
}
