
import { LlmProvider, LlmResponse, ToolCallResult, ProviderConfig } from "./types.js";

// AI Core Models and Deployment IDs (from python script)
const DEPLOYMENT_IDS: Record<string, string> = {
    "gpt-4o": "ddec36a0c07abb83",
    "gpt-4o-mini": "d45eed9e412036c4",
    "gpt-35-turbo": "d97c77c62f5fe78e",
    "gpt-4-32k": "d90005cac3a067a1",
    "llama3.1-70b": "de9acaa686e22ed9",
    "claude-3.5-sonnet": "daa9b00393e1dd22",
};

export class SAPAICoreProvider implements LlmProvider {
    private deploymentId: string;
    private apiVersion = "2024-02-15-preview";
    private history: Array<{ role: string; content: any }> = [];
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;
    private systemPrompt: string;
    private tools: any[];

    // Config vars
    private baseUrl: string;
    private authUrl: string;
    private clientId: string;
    private clientSecret: string;
    private resourceGroup: string;

    constructor(config: ProviderConfig) {
        this.systemPrompt = config.systemPrompt;
        // Map model name to deployment ID, default to gpt-4o if not found
        this.deploymentId = DEPLOYMENT_IDS[config.model] || DEPLOYMENT_IDS["gpt-4o"];
        this.tools = config.tools;

        // Load AI Core config from env
        this.baseUrl = process.env.AICORE_BASE_URL?.replace(/\/$/, "") ?? "";
        this.authUrl = process.env.AICORE_AUTH_URL ?? "";
        this.clientId = process.env.AICORE_CLIENT_ID ?? "";
        this.clientSecret = process.env.AICORE_CLIENT_SECRET ?? "";
        this.resourceGroup = process.env.AICORE_RESOURCE_GROUP ?? "default";

        if (!this.baseUrl || !this.authUrl || !this.clientId || !this.clientSecret) {
            throw new Error("Missing AI Core environment variables (AICORE_BASE_URL, AICORE_AUTH_URL, AICORE_CLIENT_ID, AICORE_CLIENT_SECRET)");
        }
    }

    private async getAccessToken(): Promise<string> {
        if (this.accessToken && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        const clientId = process.env.AICORE_CLIENT_ID;
        const clientSecret = process.env.AICORE_CLIENT_SECRET;

        // Log sensitive info only for debugging if absolutely necessary
        // console.log("Using creds:", clientId, clientSecret?.slice(0, 5) + "...");

        const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
        const params = new URLSearchParams();
        params.append("grant_type", "client_credentials");

        const response = await fetch(this.authUrl, {
            method: "POST",
            headers: {
                "Authorization": `Basic ${auth}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: params,
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`Failed to get AI Core token: ${response.status} ${txt}`);
        }

        const data = (await response.json()) as { access_token: string; expires_in: number };
        this.accessToken = data.access_token;
        // Expire 1 minute early to be safe
        this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        return this.accessToken;
    }

    private async callChatCompletion(messages: any[]): Promise<LlmResponse> {
        const token = await this.getAccessToken();
        const endpoint = `${this.baseUrl}/inference/deployments/${this.deploymentId}/chat/completions?api-version=${this.apiVersion}`;

        // Prepare OpenAI-compatible payload
        const payload: any = {
            messages,
            max_tokens: 1000,
            temperature: 0.7,
            tools: this.tools.map((t) => ({
                type: "function",
                function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema,
                },
            })),
            tool_choice: "auto",
        };

        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "AI-Resource-Group": this.resourceGroup,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const txt = await response.text();
            throw new Error(`AI Core API error: ${response.status} ${txt}`);
        }

        const data = (await response.json()) as any;
        const choice = data.choices[0];
        const message = choice.message;

        const usage = { totalTokens: data.usage?.total_tokens };

        // Check for tool calls
        if (message.tool_calls && message.tool_calls.length > 0) {
            const toolCalls = message.tool_calls.map((tc: any) => ({
                id: tc.id,
                name: tc.function.name,
                args: JSON.parse(tc.function.arguments),
            }));

            // Append assistant's response to history (it contains the tool_calls)
            this.history.push(message);

            return {
                done: false,
                text: message.content || "", // Sometimes there's content with tool calls
                toolCalls,
                usage,
            };
        }

        // Normal text response
        this.history.push(message);
        return {
            done: true,
            text: message.content,
            toolCalls: [],
            usage,
        };
    }

    async startTurn(userInput: string): Promise<LlmResponse> {
        // Initialize history with system prompt if empty
        if (this.history.length === 0) {
            this.history.push({ role: "system", content: this.systemPrompt });
        }

        this.history.push({ role: "user", content: userInput });
        return this.callChatCompletion(this.history);
    }

    async continueTurn(results: ToolCallResult[]): Promise<LlmResponse> {
        // Append tool outputs to history
        for (const res of results) {
            let content = res.isError ? `Error: ${res.content}` : res.content;

            // Safety: Truncate massive outputs to prevent context overflow
            if (content.length > 20000) {
                content = content.slice(0, 20000) + "\n... (truncated output)";
            }

            this.history.push({
                role: "tool",
                tool_call_id: res.id,
                content,
            } as any);
        }

        return this.callChatCompletion(this.history);
    }
}
