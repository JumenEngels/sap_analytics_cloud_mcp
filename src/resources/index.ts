/**
 * Resource registry
 *
 * MCP resources expose read-only data that clients can retrieve
 * (like virtual files).  They are registered via `server.resource()`.
 *
 * HOW TO ADD A NEW RESOURCE
 * ─────────────────────────
 * 1. Pick a URI scheme.  Convention: "sac://<type>/<id>"
 * 2. Call  server.resource(name, uri, handler)      — static URI
 *    or   server.resource(name, template, handler)  — URI template
 * 3. The handler receives { uri } (and template params) and must
 *    return { contents: [{ uri, text OR blob }] }
 *
 * A single placeholder resource is included so the server
 * advertises the capability.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerResources(server: McpServer): void {
  // ── Placeholder: server-info ──────────────────────────────────
  server.resource(
    "server-info",
    "sac://server/info",
    async (uri) => {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify(
              {
                name: "sac-mcp-server",
                version: "0.1.0",
                status: "running",
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── Example: templated resource skeleton ──────────────────────
  // Uncomment and adapt this for real SAC resources.
  //
  // server.resource(
  //   "sac-story",
  //   new ResourceTemplate("sac://stories/{storyId}", { list: undefined }),
  //   async (uri, { storyId }) => {
  //     // TODO: fetch story metadata from SAC
  //     return {
  //       contents: [{ uri: uri.href, text: JSON.stringify({ id: storyId }) }],
  //     };
  //   },
  // );
}
