/**
 * Calendar tools — Get, update, and copy calendar events
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacPatch } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError } from "./_helpers.js";

export function registerCalendarTools(server: McpServer): void {
  // ── GET /api/v1/calendar/events/<id> ────────────────────────────
  server.tool(
    "sac_calendar_get_event",
    "Get a calendar event by ID.",
    {
      eventId: z.string().describe("Calendar event ID"),
    },
    async ({ eventId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/calendar/events/${encodeURIComponent(eventId)}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── PATCH /api/v1/calendar/events/<id> ──────────────────────────
  server.tool(
    "sac_calendar_update_event",
    "Update a calendar event (partial update).",
    {
      eventId: z.string().describe("Calendar event ID"),
      body: z.record(z.string(), z.unknown()).describe("Fields to update"),
    },
    async ({ eventId, body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPatch(cfg, `/api/v1/calendar/events/${encodeURIComponent(eventId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/calendar/events ────────────────────────────────
  server.tool(
    "sac_calendar_copy_event",
    "Copy (create) a calendar event.",
    {
      body: z.record(z.string(), z.unknown()).describe("Event definition object"),
    },
    async ({ body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/calendar/events", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
