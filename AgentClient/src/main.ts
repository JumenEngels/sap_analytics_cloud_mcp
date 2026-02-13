/**
 * SAC Agent Client — Interactive REPL powered by any LLM provider
 * (Anthropic, OpenAI, or Gemini) that reasons about which MCP tools
 * to call on the SAC server.
 *
 * Flow: Human <-> AgentClient (LLM) <-> MCP Server
 */

import * as readline from "node:readline";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { McpBridge } from "./mcp-bridge.js";
import { createProvider, type LlmProvider, type ToolCallResult, type ProviderConfig } from "./providers/index.js";

// ── Config ───────────────────────────────────────────────────────

const VALID_PROVIDERS = ["anthropic", "openai", "gemini", "genaicore"] as const;
type ProviderName = (typeof VALID_PROVIDERS)[number];

const DEFAULT_MODELS: Record<ProviderName, string> = {
  anthropic: "claude-sonnet-4-5-20250929",
  openai: "gpt-4o",
  gemini: "gemini-2.0-flash",
  genaicore: "gpt-4o",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH
  ? resolve(process.env.MCP_SERVER_PATH)
  : resolve(__dirname, "../../build/index.js");

const SYSTEM_PROMPT = `You are an SAP Analytics Cloud assistant. Use the provided tools to help the user interact with their SAC tenant.

Rules:
- For write operations (POST, PUT, DELETE), always set allowalteration=true in the tool arguments.
- Break complex tasks into steps. Execute them sequentially.
- Show results concisely — summarise tables, highlight key fields.
- If a tool returns an error, explain it clearly and suggest next steps.
- When uncertain which tool to use, list the options and ask the user.`;

// ── Helpers ──────────────────────────────────────────────────────

function resolveProvider(): ProviderName {
  const raw = process.env.LLM_PROVIDER ?? "anthropic";
  if (!VALID_PROVIDERS.includes(raw as ProviderName)) {
    console.error(`Error: LLM_PROVIDER must be one of: ${VALID_PROVIDERS.join(", ")} (got "${raw}")`);
    process.exit(1);
  }
  return raw as ProviderName;
}

function resolveApiKey(provider: ProviderName): string {
  // Check generic key first, then provider-specific fallbacks
  const key =
    process.env.LLM_API_KEY ??
    (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined) ??
    (provider === "openai" ? process.env.OPENAI_API_KEY : undefined) ??
    (provider === "gemini" ? process.env.GOOGLE_API_KEY : undefined) ??
    (provider === "genaicore" ? "managed-internally" : undefined);

  if (!key) {
    const hint =
      provider === "anthropic" ? "ANTHROPIC_API_KEY" :
        provider === "openai" ? "OPENAI_API_KEY" : "GOOGLE_API_KEY";
    console.error(`Error: Set LLM_API_KEY or ${hint} for the ${provider} provider.`);
    process.exit(1);
  }
  return key;
}

function buildServerEnv(): Record<string, string> {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) };
  for (const key of ["SAC_BASE_URL", "SAC_TOKEN_URL", "SAC_CLIENT_ID", "SAC_CLIENT_SECRET"]) {
    if (!env[key]) {
      console.error(`Error: ${key} environment variable is required.`);
      process.exit(1);
    }
  }
  return env;
}

function confirm(rl: readline.Interface, prompt: string): Promise<boolean> {
  return new Promise((res) => {
    rl.question(prompt, (answer) => {
      res(answer.trim().toLowerCase().startsWith("y"));
    });
  });
}

function isWriteOp(args: Record<string, unknown>): boolean {
  return args.allowalteration === true;
}

// ── Main ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const providerName = resolveProvider();
  const apiKey = resolveApiKey(providerName);
  const model = process.env.LLM_MODEL ?? DEFAULT_MODELS[providerName];

  // Connect to MCP server
  const bridge = new McpBridge();
  console.log("Connecting to MCP server...");
  await bridge.connect(MCP_SERVER_PATH, buildServerEnv());
  console.log(`Connected — ${bridge.toolCount} tools available.`);

  // Create LLM provider
  const config: ProviderConfig = {
    provider: providerName,
    apiKey,
    model,
    systemPrompt: SYSTEM_PROMPT,
    tools: bridge.getTools(),
  };
  const provider = createProvider(config);
  console.log(`Using ${providerName} (${model})\n`);

  // REPL
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    rl.question("sac> ", async (input) => {
      const trimmed = input.trim();
      if (!trimmed) { prompt(); return; }
      if (trimmed === "exit" || trimmed === "quit") {
        console.log("Disconnecting...");
        await bridge.disconnect();
        rl.close();
        return;
      }

      try {
        await handleTurn(trimmed, provider, bridge, rl);
      } catch (err) {
        console.error("Agent error:", err instanceof Error ? err.message : err);
      }

      prompt();
    });
  };

  prompt();
}

async function handleTurn(
  userInput: string,
  provider: LlmProvider,
  bridge: McpBridge,
  rl: readline.Interface,
): Promise<void> {
  let response = await provider.startTurn(userInput);

  // Agentic loop: keep going while the LLM wants to call tools
  while (!response.done) {
    const results: ToolCallResult[] = [];

    for (const tc of response.toolCalls) {
      console.log(`  -> ${tc.name}(${JSON.stringify(tc.args)})`);

      // Write safety: confirm with human
      if (isWriteOp(tc.args)) {
        const ok = await confirm(rl, `  ** Write operation detected. Proceed? (y/n) `);
        if (!ok) {
          results.push({ id: tc.id, name: tc.name, content: "User declined this write operation.", isError: true });
          continue;
        }
      }

      // Execute via MCP
      try {
        const content = await bridge.callTool(tc.name, tc.args);
        results.push({ id: tc.id, name: tc.name, content });
      } catch (err) {
        results.push({
          id: tc.id,
          name: tc.name,
          content: `Error: ${err instanceof Error ? err.message : String(err)}`,
          isError: true,
        });
      }
    }

    response = await provider.continueTurn(results);
  }

  // Print final text
  if (response.text) {
    console.log("\n" + response.text + "\n");
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
