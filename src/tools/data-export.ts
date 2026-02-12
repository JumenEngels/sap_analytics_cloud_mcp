/**
 * Data Export tools — Namespaces, Providers, Data entities, Subscriptions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sacGet, sacPost, sacDelete } from "../auth/sac-client.js";
import { getConfig, toolSuccess, toolError, buildODataQuery } from "./_helpers.js";

export function registerDataExportTools(server: McpServer): void {
  // ── GET .../Namespaces ──────────────────────────────────────────
  server.tool(
    "sac_export_list_namespaces",
    "List available data export namespaces.",
    {},
    async () => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, "/api/v1/dataexport/administration/Namespaces");
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET .../Namespaces('<id>')/Providers ────────────────────────
  server.tool(
    "sac_export_list_providers",
    "List data providers within a namespace.",
    {
      namespaceId: z.string().describe("Namespace ID"),
    },
    async ({ namespaceId }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(
          cfg,
          `/api/v1/dataexport/administration/Namespaces('${encodeURIComponent(namespaceId)}')/Providers`,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET .../providers/<ns>/<prov>/$metadata ─────────────────────
  server.tool(
    "sac_export_get_provider_metadata",
    "Get OData metadata for a specific data export provider.",
    {
      namespace: z.string().describe("Namespace ID"),
      provider: z.string().describe("Provider ID"),
    },
    async ({ namespace, provider }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(
          cfg,
          `/api/v1/dataexport/administration/Namespaces('${encodeURIComponent(namespace)}')/Providers('${encodeURIComponent(provider)}')/$metadata`,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET .../providers/<ns>/<prov> ───────────────────────────────
  server.tool(
    "sac_export_get_provider_entities",
    "List entity sets available from a data export provider.",
    {
      namespace: z.string().describe("Namespace ID"),
      provider: z.string().describe("Provider ID"),
    },
    async ({ namespace, provider }) => {
      try {
        const cfg = getConfig();
        const result = await sacGet(
          cfg,
          `/api/v1/dataexport/administration/Namespaces('${encodeURIComponent(namespace)}')/Providers('${encodeURIComponent(provider)}')`,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET .../providers/<ns>/<prov>/<entitySet> + OData ───────────
  server.tool(
    "sac_export_get_data",
    "Retrieve data from a provider entity set with optional OData query parameters.",
    {
      namespace: z.string().describe("Namespace ID"),
      provider: z.string().describe("Provider ID"),
      entitySet: z.string().describe("Entity set name"),
      $top: z.number().optional().describe("Max number of results"),
      $skip: z.number().optional().describe("Number of results to skip"),
      $filter: z.string().optional().describe("OData filter expression"),
      $orderby: z.string().optional().describe("OData orderby expression"),
      $select: z.string().optional().describe("Comma-separated properties to return"),
    },
    async ({ namespace, provider, entitySet, ...odata }) => {
      try {
        const cfg = getConfig();
        const qs = buildODataQuery(odata as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(
          cfg,
          `/api/v1/dataexport/administration/Namespaces('${encodeURIComponent(namespace)}')/Providers('${encodeURIComponent(provider)}')/${encodeURIComponent(entitySet)}${qs}`,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET .../providers/<ns>/<prov>/<dim>Master ───────────────────
  server.tool(
    "sac_export_get_dimension_master",
    "Get master data for a dimension, optionally with hierarchy.",
    {
      namespace: z.string().describe("Namespace ID"),
      provider: z.string().describe("Provider ID"),
      dimension: z.string().describe("Dimension name"),
      withHierarchy: z.boolean().optional().describe("Include hierarchy (MasterWithHierarchy)"),
      $top: z.number().optional().describe("Max number of results"),
      $skip: z.number().optional().describe("Number of results to skip"),
      $filter: z.string().optional().describe("OData filter expression"),
    },
    async ({ namespace, provider, dimension, withHierarchy, ...odata }) => {
      try {
        const cfg = getConfig();
        const suffix = withHierarchy ? "MasterWithHierarchy" : "Master";
        const qs = buildODataQuery(odata as Record<string, string | number | boolean | undefined>);
        const result = await sacGet(
          cfg,
          `/api/v1/dataexport/administration/Namespaces('${encodeURIComponent(namespace)}')/Providers('${encodeURIComponent(provider)}')/${encodeURIComponent(dimension)}${suffix}${qs}`,
        );
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── GET .../Subscriptions ───────────────────────────────────────
  server.tool(
    "sac_export_list_subscriptions",
    "List data export subscriptions.",
    {},
    async () => {
      try {
        const cfg = getConfig();
        const result = await sacGet(cfg, "/api/v1/dataexport/administration/Subscriptions");
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── POST .../Subscriptions ──────────────────────────────────────
  server.tool(
    "sac_export_create_subscription",
    "Create a new data export subscription.",
    {
      body: z.record(z.string(), z.unknown()).describe("Subscription definition object"),
    },
    async ({ body }) => {
      try {
        const cfg = getConfig();
        const result = await sacPost(cfg, "/api/v1/dataexport/administration/Subscriptions", body);
        return toolSuccess(result);
      } catch (err) {
        return toolError(err);
      }
    },
  );

  // ── DELETE .../Subscriptions(...) ───────────────────────────────
  server.tool(
    "sac_export_delete_subscription",
    "Delete a data export subscription.",
    {
      subscriptionId: z.string().describe("Subscription ID"),
    },
    async ({ subscriptionId }) => {
      try {
        const cfg = getConfig();
        await sacDelete(cfg, `/api/v1/dataexport/administration/Subscriptions('${encodeURIComponent(subscriptionId)}')`);
        return toolSuccess({ deleted: true });
      } catch (err) {
        return toolError(err);
      }
    },
  );
}
