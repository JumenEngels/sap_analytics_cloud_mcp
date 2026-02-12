/**
 * Shared helpers for SAC MCP tool modules.
 *
 * - Lazy config singleton (doesn't crash at startup if env vars are missing)
 * - Standard MCP response formatters
 * - OData query-string builder
 */

import { configFromEnv, type SacClientConfig } from "../auth/sac-client.js";

// ── Lazy config singleton ─────────────────────────────────────────

let _cfg: SacClientConfig | null = null;

/** Return (and cache) the SAC client config.  Throws on first call if env vars are missing. */
export function getConfig(): SacClientConfig {
  if (!_cfg) {
    _cfg = configFromEnv();
  }
  return _cfg;
}

// ── MCP response formatters ───────────────────────────────────────

/** Wrap an API result in the MCP success envelope. */
export function toolSuccess(data: unknown): {
  content: [{ type: "text"; text: string }];
} {
  return {
    content: [
      {
        type: "text",
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

/** Wrap an error in the MCP error envelope. */
export function toolError(err: unknown): {
  content: [{ type: "text"; text: string }];
  isError: true;
} {
  const message =
    err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

// ── OData query builder ───────────────────────────────────────────

/**
 * Build a query-string from a param map, dropping undefined values.
 * Returns "" (empty) when no params are defined, or "?key=val&…" otherwise.
 */
export function buildODataQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string | number | boolean] => e[1] !== undefined,
  );
  if (entries.length === 0) return "";
  const qs = entries
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return `?${qs}`;
}
