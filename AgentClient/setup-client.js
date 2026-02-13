import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, 'mcp_agentclient.json');

const configContent = {
    "defaultProvider": "genaicore",
    "sac": {
        "SAC_BASE_URL": "https://<tenant>.sapanalytics.cloud",
        "SAC_TOKEN_URL": "https://<tenant>.authentication.../oauth/token",
        "SAC_CLIENT_ID": "sb-...",
        "SAC_CLIENT_SECRET": "..."
    },
    "aicore": {
        "AICORE_CLIENT_ID": "YOUR_AICORE_CLIENT_ID",
        "AICORE_CLIENT_SECRET": "YOUR_AICORE_CLIENT_SECRET",
        "AICORE_AUTH_URL": "https://<yourdeploymen>.authentication.eu10.hana.ondemand.com/oauth/token",
        "AICORE_BASE_URL": "https://<yourhost>.hana.ondemand.com/v2",
        "AICORE_RESOURCE_GROUP": "default"
    },
    "anthropic": {
        "apiKey": "YOUR_ANTHROPIC_API_KEY"
    },
    "openai": {
        "apiKey": "YOUR_OPENAI_API_KEY"
    },
    "gemini": {
        "apiKey": "YOUR_GOOGLE_API_KEY"
    }
};



if (!fs.existsSync(configPath)) {
    console.log('Creating mcp_agentclient.json with default configuration...');
    fs.writeFileSync(configPath, JSON.stringify(configContent, null, 2));
    console.log('Created mcp_agentclient.json');
} else {
    console.log('mcp_agentclient.json already exists. Skipping creation.');
}
