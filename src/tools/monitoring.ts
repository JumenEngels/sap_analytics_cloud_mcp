/**
 * Monitoring tools — Audit export and monitoring models
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError, buildODataQuery } from "./_helpers.js";

export function registerMonitoringTools(server: McpServer): void {
  // ── GET /api/v1/audit/activities/exportActivities ───────────────
  server.tool(
    "sac_audit_export",
    "Export audit activity logs. Supports OData query parameters for filtering.",
    {
      $top: z.number().optional().describe("Max number of results"),
      $skip: z.number().optional().describe("Number of results to skip"),
      $filter: z.string().optional().describe("OData filter expression"),
      $orderby: z.string().optional().describe("OData orderby expression"),
      $select: z.string().optional().describe("Comma-separated properties to return"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const qs = buildODataQuery(args as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `/api/v1/audit/activities/exportActivities${qs}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/monitoring/<modelId> ────────────────────────────
  server.tool(
    "sac_monitoring_get",
    "Get monitoring data for a specific model.",
    {
      modelId: z.string().describe("Model ID to get monitoring data for"),
    },
    async ({ modelId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/monitoring/${encodeURIComponent(modelId)}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
