/**
 * Provider-agnostic types for the LLM abstraction layer.
 */

/** MCP tool definition in a provider-neutral format. */
export interface McpToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A tool call requested by the LLM. */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** Result of executing a tool call — fed back to the LLM. */
export interface ToolCallResult {
  id: string;
  name: string;
  content: string;
  isError?: boolean;
}

/** Response from a single LLM round-trip. */
export interface LlmResponse {
  /** True when the model produced a final text answer (no more tool calls). */
  done: boolean;
  /** Final text (populated when done). */
  text: string;
  /** Tool calls to execute (populated when !done). */
  toolCalls: ToolCall[];
  /** Token usage statistics for this request (optional). */
  usage?: {
    totalTokens?: number;
  };
}

/**
 * Abstract LLM provider.
 *
 * Each implementation manages its own conversation history internally.
 * The caller only needs to drive the turn/continue cycle.
 */
export interface LlmProvider {
  /** Start a new conversational turn with the user's input. */
  startTurn(userInput: string): Promise<LlmResponse>;
  /** Feed tool-call results back and get the next response. */
  continueTurn(results: ToolCallResult[]): Promise<LlmResponse>;
}


/** Config passed to the provider factory. */
export interface ProviderConfig {
  provider: "anthropic" | "openai" | "gemini" | "genaicore";
  apiKey: string;
  model: string;
  systemPrompt: string;
  tools: McpToolDef[];
}
