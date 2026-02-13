/**
 * SAC Agent Client — Interactive REPL powered by any LLM provider
 * (Anthropic, OpenAI, or Gemini) that reasons about which MCP tools
 * to call on the SAC server.
 *
 * Flow: Human <-> AgentClient (LLM) <-> MCP Server
 */

import * as readline from "node:readline";
import { resolve, dirname } from "node:path";
import * as fs from "node:fs";
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


// ── Config Loading ───────────────────────────────────────────────

interface AgentConfig {
  defaultProvider?: string;
  sac?: {
    SAC_BASE_URL?: string;
    SAC_TOKEN_URL?: string;
    SAC_CLIENT_ID?: string;
    SAC_CLIENT_SECRET?: string;
  };
  aicore?: {
    AICORE_CLIENT_ID?: string;
    AICORE_CLIENT_SECRET?: string;
    AICORE_AUTH_URL?: string;
    AICORE_BASE_URL?: string;
    AICORE_RESOURCE_GROUP?: string;
  };
  anthropic?: { apiKey?: string };
  openai?: { apiKey?: string };
  gemini?: { apiKey?: string };
}

function loadConfig(): AgentConfig {
  try {
    const configPath = resolve(__dirname, "../mcp_agentclient.json");
    console.log(`Loading config from ${configPath}`);
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content) as AgentConfig;
    }
  } catch (e) {
    // ignore error, file might not exist
  }
  return {};
}

// ── Main ─────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const agentConfig = loadConfig();

  // 1. Resolve Provider
  const providerName = (process.env.LLM_PROVIDER ?? agentConfig.defaultProvider ?? "anthropic") as ProviderName;
  if (!VALID_PROVIDERS.includes(providerName)) {
    console.error(`Error: Invalid provider "${providerName}". Must be one of: ${VALID_PROVIDERS.join(", ")}`);
    process.exit(1);
  }

  // 2. Hydrate Env Vars from Config (if not already set)
  if (agentConfig.sac) {
    if (!process.env.SAC_BASE_URL && agentConfig.sac.SAC_BASE_URL) process.env.SAC_BASE_URL = agentConfig.sac.SAC_BASE_URL;
    if (!process.env.SAC_TOKEN_URL && agentConfig.sac.SAC_TOKEN_URL) process.env.SAC_TOKEN_URL = agentConfig.sac.SAC_TOKEN_URL;
    if (!process.env.SAC_CLIENT_ID && agentConfig.sac.SAC_CLIENT_ID) process.env.SAC_CLIENT_ID = agentConfig.sac.SAC_CLIENT_ID;
    if (!process.env.SAC_CLIENT_SECRET && agentConfig.sac.SAC_CLIENT_SECRET) process.env.SAC_CLIENT_SECRET = agentConfig.sac.SAC_CLIENT_SECRET;
  }

  if (providerName === "genaicore" && agentConfig.aicore) {
    if (!process.env.AICORE_CLIENT_ID && agentConfig.aicore.AICORE_CLIENT_ID) process.env.AICORE_CLIENT_ID = agentConfig.aicore.AICORE_CLIENT_ID;
    if (!process.env.AICORE_CLIENT_SECRET && agentConfig.aicore.AICORE_CLIENT_SECRET) process.env.AICORE_CLIENT_SECRET = agentConfig.aicore.AICORE_CLIENT_SECRET;
    if (!process.env.AICORE_AUTH_URL && agentConfig.aicore.AICORE_AUTH_URL) process.env.AICORE_AUTH_URL = agentConfig.aicore.AICORE_AUTH_URL;
    if (!process.env.AICORE_BASE_URL && agentConfig.aicore.AICORE_BASE_URL) process.env.AICORE_BASE_URL = agentConfig.aicore.AICORE_BASE_URL;
    if (!process.env.AICORE_RESOURCE_GROUP && agentConfig.aicore.AICORE_RESOURCE_GROUP) process.env.AICORE_RESOURCE_GROUP = agentConfig.aicore.AICORE_RESOURCE_GROUP;
  }
  if (providerName === "anthropic" && agentConfig.anthropic?.apiKey && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = agentConfig.anthropic.apiKey;
  }
  if (providerName === "openai" && agentConfig.openai?.apiKey && !process.env.OPENAI_API_KEY) {
    process.env.OPENAI_API_KEY = agentConfig.openai.apiKey;
  }
  if (providerName === "gemini" && agentConfig.gemini?.apiKey && !process.env.GOOGLE_API_KEY) {
    process.env.GOOGLE_API_KEY = agentConfig.gemini.apiKey;
  }

  // 3. Resolve Keys & Model
  // We can pass the provderName directly since we validated it above, skipping `resolveProvider()` function which duplicated logic.
  // Actually, let's just update process.env.LLM_PROVIDER so `resolveProvider` works if we seek to reuse it, 
  // but we already did the logic. Let's just use our resolved `providerName`.

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
