/**
 * Admin extras
 *
 * Endpoints of the SAC REST API that the upstream tools do not reach: the Content Network
 * inventory, SCIM2 teams by id, server-side user and team search, and the SCIM2 discovery
 * reads (service provider config, schemas, resource types), the public Content Network
 * packages, and the file repository transfer status. Team update and delete, file transfer
 * and content permissions change data and need allowalteration, like every other write tool.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacPut, sacPatch, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError } from "./_helpers.js";

const NEEDS_CONFIRMATION = "Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.";

const scimSearch = {
  filter: z.string().optional().describe('SCIM filter, e.g. userName sw "A" or displayName eq "T_SALES"'),
  attributes: z.array(z.string()).optional().describe("Attributes to return"),
  startIndex: z.number().int().min(1).optional().describe("1-based start index"),
  count: z.number().int().min(1).optional().describe("Max results"),
};

// Content Network ids are numbers in the API's answers, and strings in its paths.
const contentId = z.union([z.string(), z.number()]);

type ContentItem = Record<string, unknown> & { fields?: { fieldType?: string; fieldI18n?: { langCode?: string; value?: string }[] }[] };

/** One row per Content Network item, without the long descriptions. English text first. */
function compactItems(result: unknown, search?: string): unknown {
  const lists = (result as { itemList?: { childrenInfo?: ContentItem[] }[] })?.itemList;
  if (!Array.isArray(lists)) return result;
  const text = (item: ContentItem, type: string) => {
    const values = item.fields?.find((f) => f.fieldType === type)?.fieldI18n ?? [];
    return (values.find((v) => v.langCode === "en") ?? values[0])?.value ?? null;
  };
  const rows = lists.flatMap((l) => l.childrenInfo ?? []).map((item) => ({
    itemId: item.itemId,
    parentItemId: item.parentItemId,
    waveItemId: item.waveItemId,
    type: item.type,
    name: text(item, "name"),
    summary: text(item, "summary"),
    publisherName: item.publisherName ?? null,
    isFree: item.isFree ?? null,
    imported: item.imported ?? null,
    packageVersion: item.packageVersion ?? null,
    updated: item.updated ?? null,
    tags: item.tags ?? [],
  }));
  const needle = search?.toLowerCase();
  const hits = needle
    ? rows.filter((r) => [r.name, r.summary, r.publisherName].some((v) => typeof v === "string" && v.toLowerCase().includes(needle)))
    : rows;
  return { count: hits.length, items: hits };
}

function searchBody(a: { filter?: string; attributes?: string[]; startIndex?: number; count?: number }) {
  const body: Record<string, unknown> = { schemas: ["urn:ietf:params:scim:api:messages:2.0:SearchRequest"] };
  for (const [k, v] of Object.entries(a)) if (v !== undefined) body[k] = v;
  return body;
}

export function registerAdminExtraTools(server: McpServer): void {
  server.tool(
    "sac_content_list",
    "List the Content Network items and packages this tenant holds (POST /api/v1/content). Optional filters: itemType, permissions, tags.",
    {
      itemType: z.string().optional().describe("Item type filter"),
      permissions: z.unknown().optional().describe("Permissions filter, as the API defines it"),
      tags: z.array(z.string()).optional().describe("Tags filter"),
    },
    async (args) => {
      try {
        const cfg = getConfig();
        const body = Object.fromEntries(Object.entries(args).filter(([, v]) => v !== undefined));
        return toolSuccess(await sacPost(cfg, "/api/v1/content", body));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_teams_get",
    "Get one team (SCIM v2 group) by id, with its members.",
    { id: z.string().describe("Team id") },
    async ({ id }) => {
      try {
        const cfg = getConfig();
        return toolSuccess(await sacGet(cfg, `/api/v1/scim2/Groups/${encodeURIComponent(id)}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_users_search",
    "Search users on the server with a SCIM filter (POST /api/v1/scim2/Users/.search).",
    scimSearch,
    async (args) => {
      try {
        const cfg = getConfig();
        return toolSuccess(await sacPost(cfg, "/api/v1/scim2/Users/.search", searchBody(args)));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_teams_search",
    "Search teams on the server with a SCIM filter (POST /api/v1/scim2/Groups/.search).",
    scimSearch,
    async (args) => {
      try {
        const cfg = getConfig();
        return toolSuccess(await sacPost(cfg, "/api/v1/scim2/Groups/.search", searchBody(args)));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  for (const [name, path, text] of [
    ["sac_scim_service_config", "ServiceProviderConfig", "SCIM v2 service provider configuration: supported features and limits."],
    ["sac_scim_schemas", "Schemas", "SCIM v2 schemas, including the SAC extensions for roles and user attributes."],
    ["sac_scim_resource_types", "ResourceTypes", "SCIM v2 resource types (Users, Groups) and their schema extensions."],
  ] as const) {
    server.tool(name, text, {}, async () => {
      try {
        const cfg = getConfig();
        return toolSuccess(await sacGet(cfg, `/api/v1/scim2/${path}`));
      } catch (err) {
        return toolError(err);
      }
    });
  }

  server.tool(
    "sac_teams_update",
    "Replace a team (SCIM v2 PUT): name, members, roles.",
    {
      id: z.string().describe("Team id"),
      body: z.record(z.string(), z.unknown()).describe("SCIM Group resource"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ id, body, allowalteration }) => {
      if (!allowalteration) return toolError(NEEDS_CONFIRMATION);
      try {
        const cfg = getConfig();
        return toolSuccess(await sacPut(cfg, `/api/v1/scim2/Groups/${encodeURIComponent(id)}`, body));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_teams_delete",
    "Delete a team (SCIM v2).",
    {
      id: z.string().describe("Team id"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ id, allowalteration }) => {
      if (!allowalteration) return toolError(NEEDS_CONFIRMATION);
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `/api/v1/scim2/Groups/${encodeURIComponent(id)}`);
        return toolSuccess({ deleted: id });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_content_public_list",
    "List public Content Network items (SAP and partner packages) under a parent item, root '1' by default. Returns one compact row per item (ids, type, English name and summary, publisher, free, imported, version, updated, tags); detail=true returns the full answer with all descriptions (several hundred KB at the root). search filters rows by name, summary or publisher. Any of itemType, permissions, tags switches to the filtered POST form.",
    {
      parentItemId: z.string().optional().describe("Parent item id (default '1', the root)"),
      itemType: z.enum(["PACKAGE", "SUB-CATEGORY", "ALL"]).optional().describe("Item type filter"),
      permissions: z.array(z.enum(["list", "read", "write", "delete"])).optional().describe("Permissions the tenant must have"),
      tags: z.array(z.string()).optional().describe("Tag ids"),
      search: z.string().optional().describe("Case-insensitive text in name, summary or publisher"),
      detail: z.boolean().optional().describe("Return the full answer instead of compact rows"),
    },
    async ({ parentItemId, search, detail, ...filters }) => {
      try {
        const cfg = getConfig();
        const path = `/api/v1/content/public/${encodeURIComponent(parentItemId ?? "1")}`;
        const body = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined));
        const result = Object.keys(body).length ? await sacPost(cfg, path, body) : await sacGet(cfg, `${path}?permissions=list`);
        if (detail) return toolSuccess(result);
        return toolSuccess(compactItems(result, search));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_content_public_get",
    "Get the details of a public Content Network item.",
    {
      itemId: contentId.describe("Item id"),
      waveItemId: contentId.describe("Wave item id"),
    },
    async ({ itemId, waveItemId }) => {
      try {
        const cfg = getConfig();
        return toolSuccess(await sacGet(cfg, `/api/v1/content/public/${encodeURIComponent(String(itemId))}/${encodeURIComponent(String(waveItemId))}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_content_public_permissions",
    "Get the tenant's permissions on a public Content Network item.",
    { itemId: contentId.describe("Item id") },
    async ({ itemId }) => {
      try {
        const cfg = getConfig();
        return toolSuccess(await sacGet(cfg, `/api/v1/content/public/permissions/${encodeURIComponent(String(itemId))}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_filerepository_operation_status",
    "Status of a file repository transfer: pending, running, completed or failed.",
    { operationId: z.string().describe("Operation id from sac_filerepository_transfer") },
    async ({ operationId }) => {
      try {
        const cfg = getConfig();
        return toolSuccess(await sacGet(cfg, `/api/v1/filerepository/operations/${encodeURIComponent(operationId)}`));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_filerepository_transfer",
    "Move files or folders to a destination folder (POST /api/v1/filerepository/transfer/Resources). Needs Read, Update, Delete and Share on each resource. A moved resource loses its sharing and takes the destination folder's. Returns an operation id for sac_filerepository_operation_status.",
    {
      body: z.record(z.string(), z.unknown()).describe("Request body as the FileRepository_API defines it: the resources to move and the destination folder"),
      applyManagePrivilege: z.boolean().optional().describe("Bypass the access list checks with the Manage permission"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ body, applyManagePrivilege, allowalteration }) => {
      if (!allowalteration) return toolError(NEEDS_CONFIRMATION);
      try {
        const cfg = getConfig();
        const qs = applyManagePrivilege === undefined ? "" : `?applyManagePrivilege=${applyManagePrivilege}`;
        return toolSuccess(await sacPost(cfg, `/api/v1/filerepository/transfer/Resources${qs}`, body));
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_transport_set_permissions",
    "Edit the permissions on a private Content Network item (PUT replaces, PATCH changes).",
    {
      itemId: z.string().describe("Item id"),
      body: z.record(z.string(), z.unknown()).describe("Permissions as the content API defines them"),
      method: z.enum(["PUT", "PATCH"]).optional().describe("PUT (default) or PATCH"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ itemId, body, method, allowalteration }) => {
      if (!allowalteration) return toolError(NEEDS_CONFIRMATION);
      try {
        const cfg = getConfig();
        const path = `/api/v1/content/permissions/${encodeURIComponent(itemId)}`;
        const result = method === "PATCH" ? await sacPatch(cfg, path, body) : await sacPut(cfg, path, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
