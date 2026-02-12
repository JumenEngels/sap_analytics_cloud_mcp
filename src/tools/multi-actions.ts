/**
 * Multi Actions tools — Execute and get status
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError } from "./_helpers.js";

export function registerMultiActionTools(server: McpServer): void {
  // ── POST /api/v1/multiActions/<id>/executions ───────────────────
  server.tool(
    "sac_multi_action_execute",
    "Execute a multi action by ID.",
    {
      multiActionId: z.string().describe("Multi action ID"),
      body: z.record(z.string(), z.unknown()).optional().describe("Execution parameters"),
    },
    async ({ multiActionId, body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(
          cfg,
          `/api/v1/multiActions/${encodeURIComponent(multiActionId)}/executions`,
          body,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/multiActions/<id>/executions/<execId> ───────────
  server.tool(
    "sac_multi_action_get_status",
    "Get the execution status of a multi action.",
    {
      multiActionId: z.string().describe("Multi action ID"),
      executionId: z.string().describe("Execution ID"),
    },
    async ({ multiActionId, executionId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(
          cfg,
          `/api/v1/multiActions/${encodeURIComponent(multiActionId)}/executions/${encodeURIComponent(executionId)}`,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
