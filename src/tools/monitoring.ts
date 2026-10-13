/**
 * Monitoring tools — Activity log and system monitoring (CSV exports)
 *
 * Both endpoints page with pageSize/pageIndex and return CSV. The
 * activity log ignored OData options and returned the whole log, so the tool now pages by
 * default (100 rows) and filters through the POST form. Monitoring takes a statistic name
 * (not a user model), a date range and the performance variant.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError } from "./_helpers.js";

const SORT_KEYS = ["type", "fileName", "description", "userName", "status", "activity", "timestamp"] as const;

const STATISTICS = [
  "error", "license", "licenseConcurrent", "resource", "resourceRecentAccess", "user",
  "userAdoption", "userLive", "userSession", "backend", "client", "dataManagement",
  "planningVersion", "planningDataAction",
] as const;

function pageQuery(p: { pageSize?: number; pageIndex?: number; sortKey?: string; sortDescending?: boolean; from?: string; till?: string }): string {
  const q = new URLSearchParams();
  q.set("pageSize", String(p.pageSize ?? 100));
  q.set("pageIndex", String(p.pageIndex ?? 1));
  if (p.sortKey) q.set("sortKey", p.sortKey);
  if (p.sortDescending !== undefined) q.set("sortDescending", p.sortDescending ? "TRUE" : "FALSE");
  if (p.from) q.set("from", p.from);
  if (p.till) q.set("till", p.till);
  return `?${q.toString()}`;
}

const paging = {
  pageSize: z.number().int().min(1).max(100000).optional().describe("Rows per page (default 100, max 100000)"),
  pageIndex: z.number().int().min(1).optional().describe("Page number, from 1 (default 1)"),
  sortKey: z.enum(SORT_KEYS).optional().describe("Sort column (default timestamp)"),
  sortDescending: z.boolean().optional().describe("Sort descending"),
};

export function registerMonitoringTools(server: McpServer): void {
  server.tool(
    "sac_audit_export",
    "Export the user activity log as CSV, one page at a time (default 100 rows). Any filter (type, userName, activity, status, fileName, description, searchQuery, from, till) switches to the filtered POST form. type is an object type such as STORY, CUBE, USER, TEAM, PROFILE, EXTERNALCONNECTION, SCHEDULE.",
    {
      ...paging,
      type: z.string().optional().describe("Object type, e.g. STORY, CUBE, USER"),
      userName: z.string().optional().describe("User who performed the activity"),
      activity: z.string().optional().describe("Activity, e.g. create, read, update, delete"),
      status: z.string().optional().describe("Status, e.g. succeed"),
      fileName: z.string().optional().describe("File name of the object"),
      description: z.string().optional().describe("Activity description"),
      searchQuery: z.string().optional().describe("Free-text search"),
      from: z.string().optional().describe("Oldest timestamp, ISO 8601"),
      till: z.string().optional().describe("Newest timestamp, ISO 8601"),
    },
    async ({ pageSize, pageIndex, sortKey, sortDescending, ...filters }) => {
      try {
        const cfg = getConfig();
        const qs = pageQuery({ pageSize, pageIndex, sortKey, sortDescending });
        const body = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined));
        const path = `/api/v1/audit/activities/exportActivities${qs}`;
        const result = Object.keys(body).length ? await sacPost(cfg, path, body) : await sacGet(cfg, path);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  server.tool(
    "sac_monitoring_get",
    "Export a system monitoring statistic as CSV, one page at a time (default 100 rows). Statistics: error, license, licenseConcurrent, resource, resourceRecentAccess, user, userAdoption, userLive, userSession, backend, client, dataManagement (data management schedules), planningVersion, planningDataAction. performance=true reads the performance variant. Needs an administrator.",
    {
      statistic: z.enum(STATISTICS).describe("Statistic to export"),
      performance: z.boolean().optional().describe("Read /monitoring/performance/<statistic>"),
      from: z.string().optional().describe("Range start, ISO 8601, e.g. 2026-10-01T00:00:00Z"),
      till: z.string().optional().describe("Range end, ISO 8601"),
      ...paging,
    },
    async ({ statistic, performance, ...p }) => {
      try {
        const cfg = getConfig();
        const base = performance ? "/api/v1/monitoring/performance" : "/api/v1/monitoring";
        const result = await sacGet(cfg, `${base}/${encodeURIComponent(statistic)}${pageQuery(p)}`);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
