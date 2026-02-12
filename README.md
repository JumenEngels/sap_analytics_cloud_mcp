# SAC MCP Server

An [MCP](https://modelcontextprotocol.io/) (Model Context Protocol) server that exposes the SAP Analytics Cloud REST API as 63 tools consumable by any MCP-compatible client (Claude Desktop, Claude Code, Cursor, etc.).

## What it does

The server authenticates against an SAC tenant using OAuth 2.0 Client Credentials and manages CSRF tokens and session cookies automatically. It then exposes the full SAC REST API surface as discrete MCP tools grouped into 10 service areas:

| Module | Tools | Covers |
|---|---|---|
| Content | 10 | Stories, Resources, File Repository, Repositories, Widget Query |
| Data Export | 9 | Namespaces, Providers, Entity Sets, Subscriptions |
| Data Import | 11 | Models, Import Jobs lifecycle, One-click Import |
| Multi Actions | 2 | Execute and poll status |
| Calendar | 3 | Get, update, copy calendar events |
| Content Transport | 7 | Export/import jobs, packages, permissions |
| User Management | 10 | SCIM v2 Users, Teams/Groups, Bulk operations |
| Monitoring | 2 | Audit activity export, model monitoring |
| Schedule & Publication | 4 | Schedule CRUD |
| Translation | 4 | Artifact metadata, XLIFF download (single + bulk) |

Plus a `ping` connectivity check tool (63 total).

## Prerequisites

- **Node.js >= 18.0** (required for native `fetch` and `Headers.getSetCookie`)
- **npm**
- An SAP Analytics Cloud tenant with an OAuth client registered under **System > Administration > App Integration**

## SAC Tenant Setup

1. Open your SAC tenant and go to **System > Administration > App Integration > Add a New OAuth Client**.
2. Set the purpose to **Interactive Usage and API Access**.
3. Note down the following four values:
   - **Base URL** -- `https://<tenant>.<datacenter>.sapanalytics.cloud`
   - **Token URL** -- shown on the OAuth client detail page
   - **Client ID**
   - **Client Secret**

## Installation

```bash
git clone <repository-url>
cd SAC_MCP
npm install
```

## Configuration

The server reads four required environment variables at runtime (not at startup -- it will only fail when the first tool that hits SAC is called):

| Variable | Description | Example |
|---|---|---|
| `SAC_BASE_URL` | Tenant root URL (no trailing slash) | `https://mytenant.eu10.sapanalytics.cloud` |
| `SAC_TOKEN_URL` | OAuth token endpoint | `https://mytenant.authentication.eu10.hana.ondemand.com/oauth/token` |
| `SAC_CLIENT_ID` | OAuth Client ID | `sb-abc123-def456` |
| `SAC_CLIENT_SECRET` | OAuth Client Secret | `AbC123...` |

Create a `.env` file for convenience (never commit this file):

```
SAC_BASE_URL=https://mytenant.eu10.sapanalytics.cloud
SAC_TOKEN_URL=https://mytenant.authentication.eu10.hana.ondemand.com/oauth/token
SAC_CLIENT_ID=sb-abc123-def456
SAC_CLIENT_SECRET=your-secret-here
```

## Build

```bash
npm run build
```

This runs `tsc` and outputs compiled JavaScript to the `build/` directory.

## Running the server

The server communicates over **stdio** (stdin/stdout JSON-RPC), which is the standard transport for local MCP servers. You do not run it directly in a terminal -- instead, you register it with an MCP client.

### macOS / Linux

```bash
# Set environment variables and start (useful for testing)
SAC_BASE_URL="https://..." SAC_TOKEN_URL="https://..." SAC_CLIENT_ID="..." SAC_CLIENT_SECRET="..." node build/index.js
```

### Windows (Command Prompt)

```cmd
set SAC_BASE_URL=https://...
set SAC_TOKEN_URL=https://...
set SAC_CLIENT_ID=...
set SAC_CLIENT_SECRET=...
node build\index.js
```

### Windows (PowerShell)

```powershell
$env:SAC_BASE_URL = "https://..."
$env:SAC_TOKEN_URL = "https://..."
$env:SAC_CLIENT_ID = "..."
$env:SAC_CLIENT_SECRET = "..."
node build\index.js
```

## MCP Client Configuration

### Claude Desktop

Add the following to your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sac": {
      "command": "node",
      "args": ["/absolute/path/to/SAC_MCP/build/index.js"],
      "env": {
        "SAC_BASE_URL": "https://mytenant.eu10.sapanalytics.cloud",
        "SAC_TOKEN_URL": "https://mytenant.authentication.eu10.hana.ondemand.com/oauth/token",
        "SAC_CLIENT_ID": "sb-abc123-def456",
        "SAC_CLIENT_SECRET": "your-secret-here"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add sac -- env SAC_BASE_URL=https://... SAC_TOKEN_URL=https://... SAC_CLIENT_ID=... SAC_CLIENT_SECRET=... node /absolute/path/to/SAC_MCP/build/index.js
```

### Cursor / other MCP clients

Consult the client's documentation for adding a stdio-based MCP server. The command is always `node build/index.js` with the four environment variables set.

## Development

Watch mode recompiles on every file change:

```bash
npm run dev
```

In a second terminal, test manually:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' \
  | node build/index.js 2>/dev/null
```

## Project Structure

```
src/
  index.ts                 Entry point (stdio transport)
  auth/
    sac-client.ts          OAuth + CSRF + HTTP helpers (GET/POST/PUT/PATCH/DELETE)
  tools/
    index.ts               Barrel -- registers all tool modules + ping
    _helpers.ts            Lazy config, response formatters, OData query builder
    content.ts             Stories, Resources, File Repository, Widget Query
    data-export.ts         Namespaces, Providers, Data entities, Subscriptions
    data-import.ts         Models, Import Jobs, One-click Import
    multi-actions.ts       Execute multi actions
    calendar.ts            Calendar events
    content-transport.ts   Export/import content packages
    user-management.ts     SCIM v2 Users, Groups, Bulk
    monitoring.ts          Audit export, model monitoring
    schedule-publication.ts  Publication schedules
    translation.ts         Translation artifacts, XLIFF
  resources/
    index.ts               MCP resource handlers
```

## Things to Consider

### Security

- **Never commit credentials.** Keep `SAC_CLIENT_ID` and `SAC_CLIENT_SECRET` in environment variables or a `.env` file excluded via `.gitignore`.
- The OAuth client secret grants full API access scoped to the permissions of the technical user. Treat it like a password.
- The server holds tokens and session cookies in memory. Restarting the process clears all cached authentication state.

### Authentication

- The server uses **OAuth 2.0 Client Credentials** (Basic Auth against the Token Service). This is a technical-user flow -- all API calls run under the identity of the OAuth client, not a named user.
- Access tokens are cached and automatically refreshed 60 seconds before expiry.
- CSRF tokens are cached for 10 minutes and automatically re-fetched on 403 responses.

### Network and Connectivity

- The server must be able to reach both the SAC tenant URL and the OAuth token URL over HTTPS.
- If you are behind a corporate proxy, set `HTTPS_PROXY` (or `https_proxy`) in the environment so Node.js `fetch` can route through it.
- SAC API rate limits apply. Consult your tenant's rate limit configuration if you encounter 429 responses.

### Node.js Version

- **Minimum: Node.js 18.** The server relies on the native `fetch` API and `Headers.getSetCookie()`, both available from Node.js 18+.
- Tested on Node.js 18, 20, 22, and 25.

### MCP Transport

- The server uses **stdio transport** only. It reads JSON-RPC messages from stdin and writes responses to stdout. Diagnostic logs go to stderr.
- Do not pipe other output to stdout or the MCP protocol will break.

### Limitations

- File uploads (binary blobs) are not supported through the JSON-based MCP tool interface. The data import tools work with JSON payloads only.
- Long-running operations (export jobs, import jobs) are asynchronous on the SAC side. Use the corresponding status-polling tools to check completion.
- The server is single-tenant. To connect to multiple SAC tenants, run separate server instances with different environment variables.
