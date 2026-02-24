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
    `List stories via GET /api/v1/stories.
WARNING: This endpoint does NOT support OData filtering. All query parameters ($filter, $top, $orderby, etc.) are silently ignored by the SAC API — it always returns every story on the tenant (3000+). The response does NOT include an 'owner' field.
Response fields per story: storyId, name, createdBy, changedBy (and optionally model metadata).
TO FILTER STORIES BY USER OR TYPE use sac_filerepository_list instead, which supports real OData $filter on createdBy, modifiedBy, resourceType, createdTime, etc.`,
    {
      includeModels: z.boolean().optional().describe("Include model metadata for each story"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const params = new URLSearchParams();
        if (args.includeModels) params.append("include", "models");
        const qs = params.toString() ? `?${params.toString()}` : "";
        const result = await sacGet(cfg, `/api/v1/stories${qs}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/stories?copyFrom=<id> ─────────────────────────
  server.tool(
    "sac_stories_copy",
    "Copy a story.",
    {
      sourceStoryId: z.string().describe("Source story ID"),
      copyToFolder: z.string().optional().describe("Target folder"),
      newName: z.string().optional().describe("Name for copy"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
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
      storyId: z.string().describe("Story ID"),
      newName: z.string().describe("New name"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
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
    "Delete a story.",
    {
      storyId: z.string().describe("Story ID"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
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
    "Get OData metadata document for the SAC REST API.",
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
    "List resources via GET /api/v1/Resources (OData v2, returns XML/Atom format — not recommended for filtering). Use sac_filerepository_list for JSON responses with working OData $filter support.",
    {
      $top: z.number().optional().default(20).describe("Max results (default 20)"),
      $skip: z.number().optional().describe("Skip N results"),
      $filter: z.string().optional().describe("OData filter"),
      $orderby: z.string().optional().describe("e.g. 'name desc'"),
      $select: z.string().optional().describe("Comma-separated fields"),
      $expand: z.string().optional().describe("Expand related entities"),
      $inlinecount: z.enum(["allpages", "none"]).optional().describe("Include total count"),
      $format: z.enum(["json", "xml"]).optional().describe("Response format"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const top = args.$top ?? 20;
        const queryArgs = { ...args, $top: top };
        const qs = buildODataQuery(queryArgs as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `/api/v1/Resources${qs}`);

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
    `List file repository resources via GET /api/v1/filerepository/Resources.
This is the CORRECT tool for filtering stories/apps by user, type, or date. OData $filter, $top, $orderby, $select, $count all work.
IMPORTANT — visibility scope:
  By default (applyManagePrivilege=false), only content the service account has Read access to is returned (typically a small subset of tenant content).
  Set applyManagePrivilege=true to get ALL tenant content (all users' private folders, public folders, workspaces) — requires the service account to have the "Manage" permission for Private Files and Public Files.
  Always use applyManagePrivilege=true when the user wants to search/list across the whole tenant.
Response fields: resourceId, objectId, name, description, resourceType, resourceSubtype, createdTime, createdBy, modifiedTime, modifiedBy, folderType, workspaceId, workspaceName, openURL, isMobile, isFeatured.
Filterable fields: resourceType (values: STORY, APPLICATION, DATAACTION, PLANNINGSEQUENCE, MULTIACCOUNT, DIMENSION, ANALYTIC_MODEL), createdBy (exact username/ID), modifiedBy, createdTime, modifiedTime, name, folderType (PUBLIC, PRIVATE, SYSTEM, INPUT_SCHEDULE).
Filter examples:
  $filter=resourceType eq 'STORY' — all stories
  $filter=resourceType eq 'STORY' and createdBy eq 'USERNAME' — stories by a specific user
  $filter=resourceType eq 'STORY' and modifiedBy eq 'USERNAME' — stories last modified by user
  $filter=resourceType eq 'STORY' and createdTime gt 2024-01-01T00:00:00Z — recently created
WORKSPACE / TEAM FILES: To list all workspaces (team files spaces), filter by folderType eq 'INPUT_SCHEDULE' and workspaceId ne null. This returns exactly one entry per workspace with its workspaceId and workspaceName. Example: $filter=folderType eq 'INPUT_SCHEDULE' and workspaceId ne null with $select=workspaceId,workspaceName and $orderby=workspaceName asc.`,
    {
      applyManagePrivilege: z.boolean().optional().default(true).describe("true = return all tenant content (requires Manage permission); false = return only service account's own content. Default true for tenant-wide queries."),
      $top: z.number().optional().default(20).describe("Max results (default 20)"),
      $skip: z.number().optional().describe("Skip N results"),
      $filter: z.string().optional().describe("OData filter expression. Filterable fields: resourceType, createdBy, modifiedBy, createdTime, modifiedTime, name, folderType"),
      $orderby: z.string().optional().describe("e.g. 'createdTime desc' or 'name asc'"),
      $select: z.string().optional().describe("Comma-separated fields to return"),
      $count: z.boolean().optional().describe("Include total count in response (@odata.count)"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const top = args.$top ?? 20;
        // Build query string manually using encodeURIComponent (%20 for spaces)
        // URLSearchParams encodes spaces as '+' which breaks OData $filter expressions
        const parts: string[] = [];
        const enc = encodeURIComponent;
        parts.push(`applyManagePrivilege=${(args.applyManagePrivilege ?? true).toString()}`);
        parts.push(`$top=${top}`);
        if (args.$skip) parts.push(`$skip=${args.$skip}`);
        if (args.$filter) parts.push(`$filter=${enc(args.$filter)}`);
        if (args.$orderby) parts.push(`$orderby=${enc(args.$orderby)}`);
        if (args.$select) parts.push(`$select=${enc(args.$select)}`);
        if (args.$count) parts.push(`$count=true`);
        const result = await sacGet(cfg, `/api/v1/filerepository/Resources?${parts.join("&")}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/Repositories ────────────────────────────────────
  server.tool(
    "sac_repositories_list",
    "List repositories. Supports OData query params.",
    {
      $top: z.number().optional().default(20).describe("Max results (default 20)"),
      $skip: z.number().optional().describe("Skip N results"),
      $filter: z.string().optional().describe("OData filter"),
      $orderby: z.string().optional().describe("e.g. 'name desc'"),
      $select: z.string().optional().describe("Comma-separated fields"),
      $expand: z.string().optional().describe("Expand related entities"),
      $inlinecount: z.enum(["allpages", "none"]).optional().describe("Include total count"),
      $format: z.enum(["json", "xml"]).optional().describe("Response format"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const top = args.$top ?? 20;
        const queryArgs = { ...args, $top: top };
        const qs = buildODataQuery(queryArgs as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(cfg, `/api/v1/Repositories${qs}`);

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
    "Get widget data from a story.",
    {
      storyId: z.string().describe("Story ID"),
      widgetId: z.string().describe("Widget ID"),
      type: z.string().optional().default("kpiTile").describe("Widget type"),
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
