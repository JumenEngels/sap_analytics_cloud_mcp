/**
 * Google Gemini LLM provider.
 *
 * Uses the @google/generative-ai SDK with a ChatSession for
 * automatic history management and function calling.
 */

import {
  GoogleGenerativeAI,
  type ChatSession,
  type EnhancedGenerateContentResponse,
  type FunctionResponsePart,
  type Part,
} from "@google/generative-ai";
import type { LlmProvider, LlmResponse, ToolCallResult, ProviderConfig } from "./types.js";

export class GeminiProvider implements LlmProvider {
  private chat: ChatSession;

  constructor(config: ProviderConfig) {
    const genAI = new GoogleGenerativeAI(config.apiKey);

    // Convert MCP tools to Gemini function declarations.
    // The Gemini REST API accepts a subset of JSON Schema; we must strip
    // fields that cause 400 errors (e.g. $schema, additionalProperties).
    const functionDeclarations = config.tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: cleanSchema(t.inputSchema),
    }));

    const model = genAI.getGenerativeModel({
      model: config.model,
      tools: [{ functionDeclarations: functionDeclarations as never }],
      systemInstruction: config.systemPrompt,
    });

    this.chat = model.startChat();
  }

  async startTurn(userInput: string): Promise<LlmResponse> {
    const result = await this.chat.sendMessage(userInput);
    return this.parseResponse(result.response);
  }

  async continueTurn(results: ToolCallResult[]): Promise<LlmResponse> {
    const parts: Part[] = results.map(
      (r): FunctionResponsePart => ({
        functionResponse: {
          name: r.name,
          response: { result: r.content },
        },
      }),
    );
    const result = await this.chat.sendMessage(parts);
    return this.parseResponse(result.response);
  }

  private parseResponse(response: EnhancedGenerateContentResponse): LlmResponse {
    const usage = { totalTokens: response.usageMetadata?.totalTokenCount };

    // Check for function calls first
    const fnCalls = response.functionCalls();
    if (fnCalls && fnCalls.length > 0) {
      const toolCalls = fnCalls.map((fc, i) => ({
        id: `gemini_${Date.now()}_${i}`,
        name: fc.name,
        args: (fc.args as Record<string, unknown>) ?? {},
      }));
      return { done: false, text: "", toolCalls, usage };
    }

    // Final text response
    let text = "";
    try {
      text = response.text();
    } catch {
      // text() can throw if response was blocked by safety
    }
    return { done: true, text, toolCalls: [], usage };
  }
}

function cleanSchema(schema: any): any {
  if (!schema || typeof schema !== "object") {
    return schema;
  }
  if (Array.isArray(schema)) {
    return schema.map(cleanSchema);
  }

  const result = { ...schema };

  // Remove known problematic fields.
  delete result.$schema;
  delete result.additionalProperties;
  delete result.propertyNames;

  // Recurse into common nested structures
  if (result.properties) {
    const newProps: Record<string, unknown> = {};
    for (const key in result.properties) {
      newProps[key] = cleanSchema(result.properties[key]);
    }
    result.properties = newProps;
  }
  if (result.items) {
    result.items = cleanSchema(result.items);
  }

  // Recursively clean 'allOf', 'anyOf', 'oneOf' if present
  for (const k of ['allOf', 'anyOf', 'oneOf']) {
    if (Array.isArray(result[k])) {
      result[k] = result[k].map(cleanSchema);
    }
  }

  return result;
}
