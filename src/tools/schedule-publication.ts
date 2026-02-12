/**
 * Schedule & Publication tools — Schedules CRUD + status
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacPatch, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError } from "./_helpers.js";

export function registerSchedulePublicationTools(server: McpServer): void {
  // ── GET /api/v1/ps/schedules/template ───────────────────────────
  server.tool(
    "sac_schedule_get_template",
    "Get the schedule creation template with default values.",
    {},
    async () => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, "/api/v1/ps/schedules/template");
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/ps/schedules ───────────────────────────────────
  server.tool(
    "sac_schedule_create",
    "Create a new publication schedule.",
    {
      body: z.record(z.string(), z.unknown()).describe("Schedule definition object"),
    },
    async ({ body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/ps/schedules", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── PATCH /api/v1/ps/schedules/<id> ─────────────────────────────
  server.tool(
    "sac_schedule_update",
    "Update an existing publication schedule (partial update).",
    {
      scheduleId: z.string().describe("Schedule ID"),
      body: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ scheduleId, body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPatch(cfg, `/api/v1/ps/schedules/${encodeURIComponent(scheduleId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── DELETE /api/v1/ps/schedules/<id> ────────────────────────────
  server.tool(
    "sac_schedule_delete",
    "Delete a publication schedule. Accepts an optional JSON body.",
    {
      scheduleId: z.string().describe("Schedule ID"),
      body: z.record(z.string(), z.unknown()).optional().describe("Optional deletion parameters"),
    },
    async ({ scheduleId, body }) => {
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `/api/v1/ps/schedules/${encodeURIComponent(scheduleId)}`, body);
        return toolSuccess({ deleted: true });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
