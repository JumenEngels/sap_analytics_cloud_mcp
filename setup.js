#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const projectRoot = __dirname;
const buildPath = path.join(projectRoot, 'build', 'index.js');
const configPath = path.join(projectRoot, 'mcp_config.json');

// Check if build exists
if (!fs.existsSync(buildPath)) {
    console.warn(`\x1b[33mWarning: Build file not found at ${buildPath}\x1b[0m`);
    console.warn(`Make sure to run 'npm run build' before using the server.`);
}

// Config template
const config = {
    "mcpServers": {
        "sac": {
            "command": "node",
            "args": [buildPath],
            "env": {
                "SAC_BASE_URL": "https://YOUR_TENANT.YOUR_DC.sapanalytics.cloud",
                "SAC_TOKEN_URL": "PASTE_TOKEN_URL_FROM_SAC_ADMIN_APP_INTEGRATION",
                "SAC_CLIENT_ID": "YOUR_OAUTH_CLIENT_ID",
                "SAC_CLIENT_SECRET": "YOUR_OAUTH_CLIENT_SECRET"
            }
        }
    }
};

// Write config
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`\x1b[32m✅ Successfully generated mcp_config.json\x1b[0m`);
console.log(`Server path set to: \x1b[36m${buildPath}\x1b[0m`);
console.log(`\nNext steps:`);
console.log(`1. Edit \x1b[1mmcp_config.json\x1b[0m to add your SAC credentials.`);
console.log(`2. Copy the content to your Claude Desktop config.`);
