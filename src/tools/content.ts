/**
 * Content tools — Stories, Resources, FileRepository, Repositories, WidgetQuery
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacPatch, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError, buildODataQuery } from "./_helpers.js";

export function registerContentTools(server: McpServer): void {
  // ── GET /api/v1/stories ─────────────────────────────────────────
  server.tool(
    "sac_stories_list",
    "List stories accessible to the authenticated user. Optionally include model metadata.",
    {
      includeModels: z.boolean().optional().describe("Include model metadata (maps to ?include=models)"),
      $top: z.number().optional().default(20).describe("Max number of stories to return (default: 20)"),
      $skip: z.number().optional().describe("Number of stories to skip"),
    },
    async ({ includeModels, $top = 20, $skip = 0 }) => {
      try {
        const cfg = getConfig();
        const params = new URLSearchParams();

        if (includeModels) params.append("include", "models");

        // Try to push pagination to server
        params.append("limit", $top.toString());
        params.append("$top", $top.toString());
        if ($skip) params.append("$skip", $skip.toString());

        const path = `/api/v1/stories?${params.toString()}`;
        const result = await sacGet(cfg, path);

        // Safety: If result is an array, slice it to respect $top
        // This protects against the case where the API ignores the pagination params
        if (Array.isArray(result)) {
          return toolSuccess(result.slice(0, $top));
        }

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/stories?copyFrom=<id> ─────────────────────────
  server.tool(
    "sac_stories_copy",
    "Copy a story. By default the copy is created in the source folder.",
    {
      sourceStoryId: z.string().describe("ID of the story to copy (copyFrom)"),
      copyToFolder: z.string().optional().describe("Target folder name (copyTo)"),
      newName: z.string().optional().describe("Name for the copied story"),
      allowalteration: z.boolean().optional().describe("Security flag: Must be set to true to execute this write operation."),
    },
    async ({ sourceStoryId, copyToFolder, newName, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        let path = `/api/v1/stories?copyFrom=${encodeURIComponent(sourceStoryId)}`;
        if (copyToFolder) path += `&copyTo=${encodeURIComponent(copyToFolder)}`;
        const body = newName ? { name: newName } : undefined;
        const result = await sacPost(cfg, path, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── PATCH /api/v1/stories/<id> ──────────────────────────────────
  server.tool(
    "sac_stories_rename",
    "Rename a story.",
    {
      storyId: z.string().describe("ID of the story to rename"),
      newName: z.string().describe("New name for the story"),
      allowalteration: z.boolean().optional().describe("Security flag: Must be set to true to execute this write operation."),
    },
    async ({ storyId, newName, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const result = await sacPatch(cfg, `/api/v1/stories/${encodeURIComponent(storyId)}`, { name: newName });
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── DELETE /api/v1/stories/<id> ─────────────────────────────────
  server.tool(
    "sac_stories_delete",
    "Delete a story by ID.",
    {
      storyId: z.string().describe("ID of the story to delete"),
      allowalteration: z.boolean().optional().describe("Security flag: Must be set to true to execute this write operation."),
    },
    async ({ storyId, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `/api/v1/stories/${encodeURIComponent(storyId)}`);
        return toolSuccess({ deleted: true });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/$metadata ───────────────────────────────────────
  server.tool(
    "sac_metadata_get",
    "Get the OData metadata document for the SAC REST API.",
    {},
    async () => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, "/api/v1/$metadata");
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/Resources ───────────────────────────────────────
  server.tool(
    "sac_resources_list",
    "List resources (content objects) with optional OData query parameters.",
    {
      $top: z.number().optional().default(20).describe("Max number of results (default: 20)"),
      $skip: z.number().optional().describe("Number of results to skip"),
      $filter: z.string().optional().describe("OData filter expression"),
      $orderby: z.string().optional().describe("OData orderby expression"),
      $select: z.string().optional().describe("Comma-separated list of properties to return"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const top = args.$top ?? 20;
        // Ensure $top is passed to OData
        const queryArgs = { ...args, $top: top };
        const qs = buildODataQuery(queryArgs as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `/api/v1/Resources${qs}`);

        // Safety: Manual slicing if array
        if (Array.isArray(result) && result.length > top) {
          return toolSuccess(result.slice(0, top));
        }
        // OData often returns { value: [...] } wrapper
        if (result && typeof result === 'object' && 'value' in result && Array.isArray((result as any).value)) {
          const val = (result as any).value;
          if (val.length > top) {
            return toolSuccess({ ...result, value: val.slice(0, top) });
          }
        }

        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/Resources('<id>') ───────────────────────────────
  server.tool(
    "sac_resources_get",
    "Get a single resource by ID.",
    {
      resourceId: z.string().describe("Resource ID"),
    },
    async ({ resourceId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/Resources('${encodeURIComponent(resourceId)}')`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/filerepository/Resources ────────────────────────
  server.tool(
    "sac_filerepository_list",
    "List file repository resources with optional OData query parameters.",
    {
      $top: z.number().optional().default(20).describe("Max number of results (default: 20)"),
      $skip: z.number().optional().describe("Number of results to skip"),
      $filter: z.string().optional().describe("OData filter expression"),
      $orderby: z.string().optional().describe("OData orderby expression"),
      $select: z.string().optional().describe("Comma-separated list of properties to return"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const top = args.$top ?? 20;
        const queryArgs = { ...args, $top: top };
        const qs = buildODataQuery(queryArgs as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `/api/v1/filerepository/Resources${qs}`);

        // Safety: Manual slicing if array or OData value
        if (Array.isArray(result) && result.length > top) {
          return toolSuccess(result.slice(0, top));
        }
        if (result && typeof result === 'object' && 'value' in result && Array.isArray((result as any).value)) {
          const val = (result as any).value;
          if (val.length > top) {
            return toolSuccess({ ...result, value: val.slice(0, top) });
          }
        }
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/Repositories ────────────────────────────────────
  server.tool(
    "sac_repositories_list",
    "List repositories with optional OData query parameters.",
    {
      $top: z.number().optional().default(20).describe("Max number of results (default: 20)"),
      $skip: z.number().optional().describe("Number of results to skip"),
      $filter: z.string().optional().describe("OData filter expression"),
      $orderby: z.string().optional().describe("OData orderby expression"),
      $select: z.string().optional().describe("Comma-separated list of properties to return"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const top = args.$top ?? 20;
        const queryArgs = { ...args, $top: top };
        const qs = buildODataQuery(queryArgs as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `/api/v1/Repositories${qs}`);

        // Safety: Manual slicing
        if (Array.isArray(result) && result.length > top) {
          return toolSuccess(result.slice(0, top));
        }
        if (result && typeof result === 'object' && 'value' in result && Array.isArray((result as any).value)) {
          const val = (result as any).value;
          if (val.length > top) {
            return toolSuccess({ ...result, value: val.slice(0, top) });
          }
        }
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/widgetquery/getWidgetData ───────────────────────
  server.tool(
    "sac_widget_get_data",
    "Retrieve widget data from a story (e.g. KPI tile data).",
    {
      storyId: z.string().describe("Story ID"),
      widgetId: z.string().describe("Widget ID within the story"),
      type: z.string().optional().default("kpiTile").describe("Widget type (default: kpiTile)"),
    },
    async ({ storyId, widgetId, type }) => {
      try {
        const cfg = getConfig();
        const qs = buildODataQuery({ storyId, widgetId, type });
        const result = await sacGet(cfg, `/api/v1/widgetquery/getWidgetData${qs}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
