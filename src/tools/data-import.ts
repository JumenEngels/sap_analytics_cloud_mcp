/**
 * Data Import tools — Models, Jobs lifecycle, One-click import
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError } from "./_helpers.js";

export function registerDataImportTools(server: McpServer): void {
  // ── GET /api/v1/dataimport/models ───────────────────────────────
  server.tool(
    "sac_import_list_models",
    "List models available for data import.",
    {},
    async () => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, "/api/v1/dataimport/models");
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/dataimport/models/<id> ──────────────────────────
  server.tool(
    "sac_import_get_model",
    "Get details of a specific import model.",
    {
      modelId: z.string().describe("Model ID"),
    },
    async ({ modelId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/dataimport/models/${encodeURIComponent(modelId)}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/dataimport/models/<id>/metadata ─────────────────
  server.tool(
    "sac_import_get_model_metadata",
    "Get metadata (columns, dimensions, measures) for an import model.",
    {
      modelId: z.string().describe("Model ID"),
    },
    async ({ modelId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/dataimport/models/${encodeURIComponent(modelId)}/metadata`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/dataimport/models/<id>[/<importType>] ──────────
  server.tool(
    "sac_import_create_job",
    "Create a new data import job for a model. Optionally specify import type (e.g. factData, masterData).",
    {
      modelId: z.string().describe("Model ID"),
      importType: z.string().optional().describe("Import type segment (e.g. factData, masterData)"),
      body: z.record(z.string(), z.unknown()).optional().describe("Job creation payload"),
    },
    async ({ modelId, importType, body }) => {
      try {
        const cfg = getConfig();
        let path = `/api/v1/dataimport/models/${encodeURIComponent(modelId)}`;
        if (importType) path += `/${encodeURIComponent(importType)}`;
        const result = await sacPost(cfg, path, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/dataimport/jobs/<id> ───────────────────────────
  server.tool(
    "sac_import_upload_data",
    "Upload data to an existing import job.",
    {
      jobId: z.string().describe("Import job ID"),
      body: z.record(z.string(), z.unknown()).describe("Data payload to upload"),
    },
    async ({ jobId, body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, `/api/v1/dataimport/jobs/${encodeURIComponent(jobId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/dataimport/jobs/<id>/validate ──────────────────
  server.tool(
    "sac_import_validate_job",
    "Validate an import job before running it.",
    {
      jobId: z.string().describe("Import job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, `/api/v1/dataimport/jobs/${encodeURIComponent(jobId)}/validate`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/dataimport/jobs/<id>/run ───────────────────────
  server.tool(
    "sac_import_run_job",
    "Execute a validated import job.",
    {
      jobId: z.string().describe("Import job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, `/api/v1/dataimport/jobs/${encodeURIComponent(jobId)}/run`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/dataimport/jobs/<id>/status ─────────────────────
  server.tool(
    "sac_import_get_job_status",
    "Get the status of an import job.",
    {
      jobId: z.string().describe("Import job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/dataimport/jobs/${encodeURIComponent(jobId)}/status`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/dataimport/jobs/<id>/invalidRows ────────────────
  server.tool(
    "sac_import_get_invalid_rows",
    "Get invalid rows from an import job (after validation or run).",
    {
      jobId: z.string().describe("Import job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/dataimport/jobs/${encodeURIComponent(jobId)}/invalidRows`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── DELETE /api/v1/dataimport/jobs/<id> ─────────────────────────
  server.tool(
    "sac_import_delete_job",
    "Delete an import job.",
    {
      jobId: z.string().describe("Import job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `/api/v1/dataimport/jobs/${encodeURIComponent(jobId)}`);
        return toolSuccess({ deleted: true });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/dataimport/import/<modelId>[/<importType>] ─────
  server.tool(
    "sac_import_oneclick",
    "One-click import: create, upload, validate, and run in a single request.",
    {
      modelId: z.string().describe("Model ID"),
      importType: z.string().optional().describe("Import type segment (e.g. factData, masterData)"),
      body: z.record(z.string(), z.unknown()).describe("Full import payload (mapping + data)"),
    },
    async ({ modelId, importType, body }) => {
      try {
        const cfg = getConfig();
        let path = `/api/v1/dataimport/import/${encodeURIComponent(modelId)}`;
        if (importType) path += `/${encodeURIComponent(importType)}`;
        const result = await sacPost(cfg, path, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
