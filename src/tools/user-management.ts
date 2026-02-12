/**
 * User Management tools — SCIM v2 Users, Teams (Groups), Bulk
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacPut, sacPatch, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError, buildODataQuery } from "./_helpers.js";

export function registerUserManagementTools(server: McpServer): void {
  // ── GET /api/v1/scim2/Users ─────────────────────────────────────
  server.tool(
    "sac_users_list",
    "List users (SCIM v2). Supports filter and pagination.",
    {
      filter: z.string().optional().describe("SCIM filter expression (e.g. userName eq \"admin\")"),
      startIndex: z.number().optional().describe("1-based start index for pagination"),
      count: z.number().optional().describe("Max number of users to return"),
    },
    async ({ filter, startIndex, count }) => {
      try {
        const cfg = getConfig();
        const qs = buildODataQuery({ filter, startIndex, count });
        const result = await sacGet(cfg, `/api/v1/scim2/Users${qs}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/scim2/Users/<uuid> ──────────────────────────────
  server.tool(
    "sac_users_get",
    "Get a single user by UUID (SCIM v2).",
    {
      userId: z.string().describe("User UUID"),
    },
    async ({ userId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, `/api/v1/scim2/Users/${encodeURIComponent(userId)}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/scim2/Users ────────────────────────────────────
  server.tool(
    "sac_users_create",
    "Create a new user (SCIM v2).",
    {
      body: z.record(z.string(), z.unknown()).describe("SCIM User resource object"),
    },
    async ({ body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/scim2/Users", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── PUT /api/v1/scim2/Users/<uuid> ──────────────────────────────
  server.tool(
    "sac_users_update",
    "Full replacement update of a user (SCIM v2 PUT).",
    {
      userId: z.string().describe("User UUID"),
      body: z.record(z.string(), z.unknown()).describe("Complete SCIM User resource object"),
    },
    async ({ userId, body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPut(cfg, `/api/v1/scim2/Users/${encodeURIComponent(userId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── PATCH /api/v1/scim2/Users/<uuid> ────────────────────────────
  server.tool(
    "sac_users_patch",
    "Partial update of a user (SCIM v2 PATCH).",
    {
      userId: z.string().describe("User UUID"),
      body: z.record(z.string(), z.unknown()).describe("SCIM PatchOp object with Operations array"),
    },
    async ({ userId, body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPatch(cfg, `/api/v1/scim2/Users/${encodeURIComponent(userId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── DELETE /api/v1/scim2/Users/<uuid> ───────────────────────────
  server.tool(
    "sac_users_delete",
    "Delete a user by UUID (SCIM v2).",
    {
      userId: z.string().describe("User UUID"),
    },
    async ({ userId }) => {
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `/api/v1/scim2/Users/${encodeURIComponent(userId)}`);
        return toolSuccess({ deleted: true });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET /api/v1/scim2/Groups ────────────────────────────────────
  server.tool(
    "sac_teams_list",
    "List teams/groups (SCIM v2). Supports filter and pagination.",
    {
      filter: z.string().optional().describe("SCIM filter expression"),
      startIndex: z.number().optional().describe("1-based start index for pagination"),
      count: z.number().optional().describe("Max number of groups to return"),
    },
    async ({ filter, startIndex, count }) => {
      try {
        const cfg = getConfig();
        const qs = buildODataQuery({ filter, startIndex, count });
        const result = await sacGet(cfg, `/api/v1/scim2/Groups${qs}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/scim2/Groups ──────────────────────────────────
  server.tool(
    "sac_teams_create",
    "Create a new team/group (SCIM v2). Optionally create a team folder.",
    {
      body: z.record(z.string(), z.unknown()).describe("SCIM Group resource object"),
      createTeamFolder: z.boolean().optional().describe("Set x-sap-sac-create-team-folder header to create associated folder"),
    },
    async ({ body, createTeamFolder }) => {
      try {
        const cfg = getConfig();
        const extra: Record<string, string> = {};
        if (createTeamFolder) {
          extra["x-sap-sac-create-team-folder"] = "true";
        }
        const result = await sacPost(cfg, "/api/v1/scim2/Groups", body, extra);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── PATCH /api/v1/scim2/Groups/<uuid> ───────────────────────────
  server.tool(
    "sac_teams_patch",
    "Partial update of a team/group (SCIM v2 PATCH).",
    {
      groupId: z.string().describe("Group UUID"),
      body: z.record(z.string(), z.unknown()).describe("SCIM PatchOp object with Operations array"),
    },
    async ({ groupId, body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPatch(cfg, `/api/v1/scim2/Groups/${encodeURIComponent(groupId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST /api/v1/scim2/Bulk ─────────────────────────────────────
  server.tool(
    "sac_users_bulk",
    "Execute bulk SCIM operations (create, update, delete multiple users/groups).",
    {
      body: z.record(z.string(), z.unknown()).describe("SCIM Bulk request object with Operations array"),
    },
    async ({ body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/scim2/Bulk", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
