/**
 * Translation tools — Artifacts metadata, XLIFF download/upload
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError, buildODataQuery } from "./_helpers.js";

export function registerTranslationTools(server: McpServer): void {
  // ── GET /api/v1/ts/artifacts/metadata ───────────────────────────
  server.tool(
    "sac_translation_list_artifacts",
    "List translatable artifacts with optional OData query parameters.",
    {
      $top: z.number().optional().describe("Max number of results"),
      $skip: z.number().optional().describe("Number of results to skip"),
      $filter: z.string().optional().describe("OData filter expression"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const qs = buildODataQuery(args as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `/api/v1/ts/artifacts/metadata${qs}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/ts/artifacts/<id>/metadata ──────────────────────
  server.tool(
    "sac_translation_get_artifact",
    "Get metadata for a specific translatable artifact.",
    {
      artifactId: z.string().describe("Artifact ID"),
    },
    async ({ artifactId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/ts/artifacts/${encodeURIComponent(artifactId)}/metadata`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/ts/artifacts/<id>/source/xliff ──────────────────
  server.tool(
    "sac_translation_download_xliff",
    "Download the XLIFF translation file for a single artifact.",
    {
      artifactId: z.string().describe("Artifact ID"),
    },
    async ({ artifactId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/ts/artifacts/${encodeURIComponent(artifactId)}/source/xliff`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/ts/artifacts/source/xliff ──────────────────────
  server.tool(
    "sac_translation_download_xliff_bulk",
    "Download XLIFF translation files for multiple artifacts in bulk.",
    {
      body: z.record(z.string(), z.unknown()).describe("Bulk download request body with artifact IDs"),
    },
    async ({ body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/ts/artifacts/source/xliff", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
