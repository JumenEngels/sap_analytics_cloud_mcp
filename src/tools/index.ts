/**
 * Tool registry — barrel that imports and registers all tool modules.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerContentTools } from "./content.js";
import { registerDataExportTools } from "./data-export.js";
import { registerDataImportTools } from "./data-import.js";
import { registerMultiActionTools } from "./multi-actions.js";
import { registerCalendarTools } from "./calendar.js";
import { registerContentTransportTools } from "./content-transport.js";
import { registerUserManagementTools } from "./user-management.js";
import { registerMonitoringTools } from "./monitoring.js";
import { registerSchedulePublicationTools } from "./schedule-publication.js";
import { registerTranslationTools } from "./translation.js";

export function registerTools(server: McpServer): void {
  // ── Connectivity check ──────────────────────────────────────────
  server.tool(
    "ping",
    "Returns pong — useful for verifying connectivity",
    {},
    async () => ({
      content: [{ type: "text" as const, text: "pong" }],
    }),
  );

  // ── SAC API tool modules ────────────────────────────────────────
  registerContentTools(server);
  registerDataExportTools(server);
  registerDataImportTools(server);
  registerMultiActionTools(server);
  registerCalendarTools(server);
  registerContentTransportTools(server);
  registerUserManagementTools(server);
  registerMonitoringTools(server);
  registerSchedulePublicationTools(server);
  registerTranslationTools(server);
}
