/**
 * Data Import tools — Models, Jobs, Public Dimensions, Currency/Unit Conversions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError } from "./_helpers.js";

const BASE = "/api/v1/dataimport";

// ── Shared Zod schemas ──────────────────────────────────────────────

const importMethodSchema = z.enum(["Update", "Append", "CleanAndReplace", "DeleteAndUpsert", "DropAndInsert"])
  .optional()
  .describe("Import method");

const jobSettingsSchema = z.object({
  importMethod: importMethodSchema,
  dimensionScope: z.array(z.string()).optional()
    .describe("Dimensions for CleanAndReplace scope"),
  executeWithFailedRows: z.boolean().optional()
    .describe("Proceed even if invalid rows (default: true)"),
  ignoreAdditionalColumns: z.boolean().optional()
    .describe("Ignore extra columns (default: false)"),
  pivotOptions: z.object({
    pivotColumnStart: z.number().describe("Starting column index"),
    pivotKeyName: z.string().describe("Pivoted dimension name"),
    pivotValueName: z.string().describe("Measure column name"),
  }).optional().describe("Pivot settings"),
  dateFormats: z.record(z.string(), z.string()).optional()
    .describe("Date format per column"),
  reverseSignByAccountType: z.boolean().optional()
    .describe("Reverse sign for INC/LEQ accounts"),
}).optional().describe("Job settings");

const mappingSchema = z.record(z.string(), z.string()).optional()
  .describe("Column mapping: { source: target }");

const defaultValuesSchema = z.record(z.string(), z.unknown()).optional()
  .describe("Default values for missing columns");

const importTypeSchema = z.enum(["factData", "masterData", "masterFactData", "privateFactData"])
  .optional()
  .describe("Import type");

export function registerDataImportTools(server: McpServer): void {

  // ── Models ────────────────────────────────────────────────────────

  server.tool(
    "sac_import_list_models",
    "List models available for data import. Does NOT support name filtering — returns all models. To find a model ID by name, use sac_filerepository_list with $filter=name eq 'MODEL_NAME' and resourceType eq 'ANALYTIC_MODEL' — the returned resourceId is the model ID.",
    {
      top: z.number().optional().describe("Max number of results"),
    },
    async ({ top }) => {
      try {
        const cfg = getConfig();
        // Try OData $top, but also slice manually if API ignores it
        const url = top ? `${BASE}/models?$top=${top}` : `${BASE}/models`;
        let result = await sacGet(cfg, url);

        if (top && Array.isArray(result)) {
          result = result.slice(0, top);
        } else if (top && result && typeof result === 'object' && 'models' in result && Array.isArray((result as any).models)) {
          (result as any).models = (result as any).models.slice(0, top);
        }

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_model",
    "Get model import types, versions, settings, and metadata URL.",
    {
      modelId: z.string().describe("Model ID"),
    },
    async ({ modelId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/models/${modelId}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_model_metadata",
    "Get model dimension names, measure names and field types. Call this BEFORE sac_export_get_fact_data_aggregation to discover valid $select fields (e.g. PD_O_BusinessUnit, SignedData). Required whenever field names are unknown. Use when: aggregating fact data, exporting by dimension, querying model structure.",
    {
      modelId: z.string().describe("Model ID"),
    },
    async ({ modelId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/models/${modelId}/metadata`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_create_job",
    "Create import job for a model. Returns JobID/JobURL.",
    {
      modelId: z.string().describe("Model ID"),
      importType: importTypeSchema,
      Mapping: mappingSchema,
      JobSettings: jobSettingsSchema,
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ modelId, importType, Mapping, JobSettings, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const path = importType
          ? `${BASE}/models/${modelId}/${importType}`
          : `${BASE}/models/${modelId}`;

        const body: Record<string, unknown> = {};
        if (Mapping) body.Mapping = Mapping;
        if (JobSettings) body.JobSettings = JobSettings;

        const result = await sacPost(cfg, path, Object.keys(body).length > 0 ? body : undefined);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── Jobs ──────────────────────────────────────────────────────────

  server.tool(
    "sac_import_list_jobs",
    "List all import jobs. filter is an OData $filter on the job list.",
    {
      top: z.number().optional().describe("Max number of results"),
      filter: z.string().optional().describe("OData filter, e.g. jobStatus eq 'FAILED'"),
    },
    async ({ top, filter }) => {
      try {
        const cfg = getConfig();
        // Pass the spec's $filter through.
        const q = new URLSearchParams();
        if (top) q.set("$top", String(top));
        if (filter) q.set("$filter", filter);
        const qs = q.toString().replace(/%24/g, "$").replace(/\+/g, "%20");
        const url = qs ? `${BASE}/jobs?${qs}` : `${BASE}/jobs`;
        let result = await sacGet(cfg, url);

        if (top && Array.isArray(result)) {
          result = result.slice(0, top);
        } else if (top && result && typeof result === 'object' && 'jobs' in result && Array.isArray((result as any).jobs)) {
          (result as any).jobs = (result as any).jobs.slice(0, top);
        }

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_upload_data",
    "Upload data to an import job. Returns upserted/failed row counts.",
    {
      jobId: z.string().describe("Job ID"),
      Data: z.array(z.record(z.string(), z.unknown()))
        .describe("Data rows to import"),
      DeletedData: z.array(z.record(z.string(), z.unknown())).optional()
        .describe("Rows to delete (currency/unit jobs only)"),
      Mapping: mappingSchema,
      DefaultValues: defaultValuesSchema,
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ jobId, Data, DeletedData, Mapping, DefaultValues, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const body: Record<string, unknown> = { Data };
        if (DeletedData) body.DeletedData = DeletedData;
        if (Mapping) body.Mapping = Mapping;
        if (DefaultValues) body.DefaultValues = DefaultValues;

        const result = await sacPost(cfg, `${BASE}/jobs/${jobId}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_validate_job",
    "Validate import job before running.",
    {
      jobId: z.string().describe("Job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, `${BASE}/jobs/${jobId}/validate`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_run_job",
    "Execute validated import job.",
    {
      jobId: z.string().describe("Job ID"),
      overrideExecuteWithFailedRows: z.boolean().optional()
        .describe("Force write despite failed rows"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ jobId, overrideExecuteWithFailedRows, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const body = overrideExecuteWithFailedRows
          ? { overrideExecuteWithFailedRows: true }
          : undefined;
        const result = await sacPost(cfg, `${BASE}/jobs/${jobId}/run`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_job_status",
    "Get job status: READY_FOR_DATA, READY_FOR_WRITE, PROCESSING, COMPLETED, FAILED.",
    {
      jobId: z.string().describe("Job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/jobs/${jobId}/status`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_invalid_rows",
    "Get rejected rows with rejection reasons.",
    {
      jobId: z.string().describe("Job ID"),
    },
    async ({ jobId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/jobs/${jobId}/invalidRows`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_delete_job",
    "Delete an import job.",
    {
      jobId: z.string().describe("Job ID"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ jobId, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `${BASE}/jobs/${jobId}`);
        return toolSuccess({ deleted: true });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── One-Click Import ──────────────────────────────────────────────

  server.tool(
    "sac_import_oneclick",
    "One-click: create job, upload, validate, run in one request.",
    {
      modelId: z.string().describe("Model ID"),
      importType: importTypeSchema,
      Data: z.array(z.record(z.string(), z.unknown()))
        .describe("Data rows"),
      Mapping: mappingSchema,
      DefaultValues: defaultValuesSchema,
      JobSettings: jobSettingsSchema,
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ modelId, importType, Data, Mapping, DefaultValues, JobSettings, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const path = importType
          ? `${BASE}/import/${modelId}/${importType}`
          : `${BASE}/import/${modelId}`;

        const body: Record<string, unknown> = { Data };
        if (Mapping) body.Mapping = Mapping;
        if (DefaultValues) body.DefaultValues = DefaultValues;
        if (JobSettings) body.JobSettings = JobSettings;

        const result = await sacPost(cfg, path, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── Public Dimensions ─────────────────────────────────────────────

  server.tool(
    "sac_import_list_public_dimensions",
    "List public dimensions available for import.",
    {
      top: z.number().optional().describe("Max number of results"),
    },
    async ({ top }) => {
      try {
        const cfg = getConfig();
        const url = top ? `${BASE}/publicDimensions?$top=${top}` : `${BASE}/publicDimensions`;
        let result = await sacGet(cfg, url);

        if (top && Array.isArray(result)) {
          result = result.slice(0, top);
        } else if (top && result && typeof result === 'object' && 'publicDimensions' in result && Array.isArray((result as any).publicDimensions)) {
          (result as any).publicDimensions = (result as any).publicDimensions.slice(0, top);
        }

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_public_dimension",
    "Get public dimension import types and metadata URL.",
    {
      publicDimensionId: z.string().describe("Public dimension ID"),
    },
    async ({ publicDimensionId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/publicDimensions/${publicDimensionId}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_public_dimension_metadata",
    "Get public dimension metadata: columns, types, keys.",
    {
      publicDimensionId: z.string().describe("Public dimension ID"),
    },
    async ({ publicDimensionId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/publicDimensions/${publicDimensionId}/metadata`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_create_public_dimension_job",
    "Create import job for a public dimension.",
    {
      publicDimensionId: z.string().describe("Public dimension ID"),
      Mapping: mappingSchema,
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ publicDimensionId, Mapping, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const body: Record<string, unknown> = {};
        if (Mapping) body.Mapping = Mapping;
        const result = await sacPost(
          cfg,
          `${BASE}/publicDimensions/${publicDimensionId}/publicDimensionData`,
          Object.keys(body).length > 0 ? body : undefined,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── Currency Conversions ──────────────────────────────────────────

  server.tool(
    "sac_import_list_currency_conversions",
    "List currency conversion tables for import.",
    {
      top: z.number().optional().describe("Max number of results"),
    },
    async ({ top }) => {
      try {
        const cfg = getConfig();
        const url = top ? `${BASE}/currencyConversions?$top=${top}` : `${BASE}/currencyConversions`;
        let result = await sacGet(cfg, url);

        if (top && Array.isArray(result)) {
          result = result.slice(0, top);
        } else if (top && result && typeof result === 'object' && 'currencyConversions' in result && Array.isArray((result as any).currencyConversions)) {
          (result as any).currencyConversions = (result as any).currencyConversions.slice(0, top);
        }

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_currency_conversion",
    "Get currency conversion import types and settings.",
    {
      currencyConversionId: z.string().describe("Currency conversion ID"),
    },
    async ({ currencyConversionId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/currencyConversions/${currencyConversionId}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_currency_conversion_metadata",
    "Get currency conversion metadata: columns, types, keys.",
    {
      currencyConversionId: z.string().describe("Currency conversion ID"),
    },
    async ({ currencyConversionId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/currencyConversions/${currencyConversionId}/metadata`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_create_currency_conversion_job",
    "Create import job for a currency conversion table.",
    {
      currencyConversionId: z.string().describe("Currency conversion ID"),
      importType: z.string().optional().describe("e.g. currencyTable"),
      Mapping: mappingSchema,
      JobSettings: z.object({
        importMethod: z.enum(["DeleteAndUpsert", "DropAndInsert"]).optional()
          .describe("Import method"),
      }).optional().describe("Job settings"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ currencyConversionId, importType, Mapping, JobSettings, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const path = importType
          ? `${BASE}/currencyConversions/${currencyConversionId}/${importType}`
          : `${BASE}/currencyConversions/${currencyConversionId}`;

        const body: Record<string, unknown> = {};
        if (Mapping) body.Mapping = Mapping;
        if (JobSettings) body.JobSettings = JobSettings;

        const result = await sacPost(cfg, path, Object.keys(body).length > 0 ? body : undefined);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── Unit Conversions ──────────────────────────────────────────────

  server.tool(
    "sac_import_list_unit_conversions",
    "List unit conversion tables for import.",
    {
      top: z.number().optional().describe("Max number of results"),
    },
    async ({ top }) => {
      try {
        const cfg = getConfig();
        const url = top ? `${BASE}/unitConversions?$top=${top}` : `${BASE}/unitConversions`;
        let result = await sacGet(cfg, url);

        if (top && Array.isArray(result)) {
          result = result.slice(0, top);
        } else if (top && result && typeof result === 'object' && 'unitConversions' in result && Array.isArray((result as any).unitConversions)) {
          (result as any).unitConversions = (result as any).unitConversions.slice(0, top);
        }

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_unit_conversion",
    "Get unit conversion import types and settings.",
    {
      unitConversionId: z.string().describe("Unit conversion ID"),
    },
    async ({ unitConversionId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/unitConversions/${unitConversionId}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_get_unit_conversion_metadata",
    "Get unit conversion metadata: columns, types, keys.",
    {
      unitConversionId: z.string().describe("Unit conversion ID"),
    },
    async ({ unitConversionId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `${BASE}/unitConversions/${unitConversionId}/metadata`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_import_create_unit_conversion_job",
    "Create import job for a unit conversion table.",
    {
      unitConversionId: z.string().describe("Unit conversion ID"),
      importType: z.string().optional().describe("e.g. conversionRates, unitDescriptions"),
      Mapping: mappingSchema,
      DefaultValues: defaultValuesSchema,
      JobSettings: z.object({
        executeWithFailedRows: z.boolean().optional()
          .describe("Proceed despite invalid rows"),
      }).optional().describe("Job settings"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ unitConversionId, importType, Mapping, DefaultValues, JobSettings, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const path = importType
          ? `${BASE}/unitConversions/${unitConversionId}/${importType}`
          : `${BASE}/unitConversions/${unitConversionId}`;

        const body: Record<string, unknown> = {};
        if (Mapping) body.Mapping = Mapping;
        if (DefaultValues) body.DefaultValues = DefaultValues;
        if (JobSettings) body.JobSettings = JobSettings;

        const result = await sacPost(cfg, path, Object.keys(body).length > 0 ? body : undefined);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
