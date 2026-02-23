/**
 * OpenAI LLM provider (GPT-4o, etc.).
 */

import OpenAI from "openai";
import type { LlmProvider, LlmResponse, ToolCallResult, ProviderConfig } from "./types.js";

export class OpenAIProvider implements LlmProvider {
  private client: OpenAI;
  private model: string;
  private system: string;
  private tools: OpenAI.Chat.Completions.ChatCompletionTool[];
  private messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model;
    this.system = config.systemPrompt;
    this.tools = config.tools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema as Record<string, unknown>,
      },
    }));
  }

  async startTurn(userInput: string): Promise<LlmResponse> {
    this.messages.push({ role: "user", content: userInput });
    return this.callApi();
  }

  async continueTurn(results: ToolCallResult[]): Promise<LlmResponse> {
    for (const r of results) {
      this.messages.push({
        role: "tool" as const,
        tool_call_id: r.id,
        content: r.content,
      });
    }
    return this.callApi();
  }

  private async callApi(): Promise<LlmResponse> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: "system", content: this.system },
        ...this.messages,
      ],
      tools: this.tools.length > 0 ? this.tools : undefined,
    });

    const choice = response.choices[0];
    const message = choice.message;

    // Store assistant message in history
    this.messages.push({
      role: "assistant" as const,
      content: message.content,
      ...(message.tool_calls?.length ? { tool_calls: message.tool_calls } : {}),
    } as OpenAI.Chat.Completions.ChatCompletionMessageParam);

    const usage = { totalTokens: response.usage?.total_tokens };

    if (choice.finish_reason === "tool_calls" && message.tool_calls) {
      const toolCalls = message.tool_calls.map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        args: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));
      return { done: false, text: "", toolCalls, usage };
    }

    return { done: true, text: message.content ?? "", toolCalls: [], usage };
  }
}
