/**
 * User Management tools — SCIM v2 Users, Teams (Groups), Bulk
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacPut, sacPatch, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError, buildODataQuery } from "./_helpers.js";

export function registerUserManagementTools(server: McpServer): void {
  server.tool(
    "sac_users_list",
    "List users (SCIM v2).",
    {
      filter: z.string().optional().describe("SCIM filter"),
      startIndex: z.number().optional().describe("1-based start index"),
      count: z.number().optional().describe("Max results"),
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

  server.tool(
    "sac_users_get",
    "Get a user by UUID.",
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

  server.tool(
    "sac_users_create",
    "Create a user (SCIM v2).",
    {
      body: z.record(z.string(), z.unknown()).describe("SCIM User resource"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ body, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/scim2/Users", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_users_update",
    "Full replace of a user (SCIM v2 PUT).",
    {
      userId: z.string().describe("User UUID"),
      body: z.record(z.string(), z.unknown()).describe("Complete SCIM User resource"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ userId, body, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const result = await sacPut(cfg, `/api/v1/scim2/Users/${encodeURIComponent(userId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_users_patch",
    "Partial update of a user (SCIM v2 PATCH).",
    {
      userId: z.string().describe("User UUID"),
      body: z.record(z.string(), z.unknown()).describe("SCIM PatchOp with Operations"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ userId, body, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const result = await sacPatch(cfg, `/api/v1/scim2/Users/${encodeURIComponent(userId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_users_delete",
    "Delete a user.",
    {
      userId: z.string().describe("User UUID"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ userId, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `/api/v1/scim2/Users/${encodeURIComponent(userId)}`);
        return toolSuccess({ deleted: true });
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_teams_list",
    "List user security groups via SCIM v2 (/api/v1/scim2/Groups). Returns groups used for role assignments and access control (e.g. T_SALES, T_HR). These are identity/authorization groups, not file storage folders.",
    {
      filter: z.string().optional().describe("SCIM filter"),
      startIndex: z.number().optional().describe("1-based start index"),
      count: z.number().optional().describe("Max results"),
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

  server.tool(
    "sac_teams_create",
    "Create a team/group (SCIM v2).",
    {
      body: z.record(z.string(), z.unknown()).describe("SCIM Group resource"),
      createTeamFolder: z.boolean().optional().describe("Create associated team folder"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ body, createTeamFolder, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
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

  server.tool(
    "sac_teams_patch",
    "Partial update of a team/group (SCIM v2 PATCH).",
    {
      groupId: z.string().describe("Group UUID"),
      body: z.record(z.string(), z.unknown()).describe("SCIM PatchOp with Operations"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ groupId, body, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
      try {
        const cfg = getConfig();
        const result = await sacPatch(cfg, `/api/v1/scim2/Groups/${encodeURIComponent(groupId)}`, body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_users_bulk",
    "Bulk SCIM operations (create/update/delete multiple users/groups).",
    {
      body: z.record(z.string(), z.unknown()).describe("SCIM Bulk request with Operations"),
      allowalteration: z.boolean().optional().describe("Must be true to execute"),
    },
    async ({ body, allowalteration }) => {
      if (!allowalteration) {
        return toolError("Security Requirement: This operation changes data. Please confirm by calling again with 'allowalteration=true'.");
      }
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
