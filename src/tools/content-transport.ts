/**
 * Content Transport tools — Export/import jobs, packages, permissions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacPut, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError } from "./_helpers.js";

export function registerContentTransportTools(server: McpServer): void {
  // ── POST /api/v1/content/jobs (export) ──────────────────────────
  server.tool(
    "sac_transport_create_export_job",
    "Create a content transport export job.",
    {
      body: z.record(z.string(), z.unknown()).describe("Export job definition (must include exportType)"),
    },
    async ({ body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/content/jobs", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/content/jobs/<id> ───────────────────────────────
  server.tool(
    "sac_transport_get_job_status",
    "Get the status of a content transport job.",
    {
      jobId: z.string().describe("Content transport job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/content/jobs/${encodeURIComponent(jobId)}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/content/jobs (import) ──────────────────────────
  server.tool(
    "sac_transport_create_import_job",
    "Create a content transport import job.",
    {
      body: z.record(z.string(), z.unknown()).describe("Import job definition (must include importType)"),
    },
    async ({ body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/content/jobs", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── DELETE /api/v1/content/<itemId> ─────────────────────────────
  server.tool(
    "sac_transport_delete_content",
    "Delete a content item by ID.",
    {
      itemId: z.string().describe("Content item ID"),
    },
    async ({ itemId }) => {
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `/api/v1/content/${encodeURIComponent(itemId)}`);
        return toolSuccess({ deleted: true });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/content/<itemId>/<waveItemId> ───────────────────
  server.tool(
    "sac_transport_get_content_item",
    "Get details of a content item within a wave.",
    {
      itemId: z.string().describe("Content item ID"),
      waveItemId: z.string().describe("Wave item ID"),
    },
    async ({ itemId, waveItemId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(
          cfg,
          `/api/v1/content/${encodeURIComponent(itemId)}/${encodeURIComponent(waveItemId)}`,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/content/permissions/<itemId> ────────────────────
  server.tool(
    "sac_transport_get_permissions",
    "Get permissions for a content item.",
    {
      itemId: z.string().describe("Content item ID"),
    },
    async ({ itemId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/content/permissions/${encodeURIComponent(itemId)}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── PUT /api/v1/content/<itemId>/<targetId> ─────────────────────
  server.tool(
    "sac_transport_move_item",
    "Move a content item to a target location.",
    {
      itemId: z.string().describe("Content item ID to move"),
      targetId: z.string().describe("Target location ID"),
      body: z.record(z.string(), z.unknown()).optional().describe("Additional move parameters"),
    },
    async ({ itemId, targetId, body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPut(
          cfg,
          `/api/v1/content/${encodeURIComponent(itemId)}/${encodeURIComponent(targetId)}`,
          body ?? {},
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
