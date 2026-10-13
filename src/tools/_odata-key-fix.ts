/**
 * Claude rejects a tool parameter name that starts with "$" (the name must match
 * ^[a-zA-Z0-9_.-]{1,64}$). 18 tools take OData options as $top, $filter and so on.
 * This registers each such parameter as odata_<name> and maps it back before the handler
 * runs, so the handlers stay unchanged. Upstream issue #1.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type AnyFn = (...args: unknown[]) => unknown;

export function withODataKeyFix(server: McpServer): McpServer {
  const register = server.tool.bind(server) as unknown as AnyFn;
  const patched: AnyFn = (...args) => {
    const last = args.length - 1;
    const handler = args[last];
    const shape = args[last - 1];
    if (typeof handler === "function" && shape !== null && typeof shape === "object" && !Array.isArray(shape)) {
      const original = shape as Record<string, unknown>;
      const renamed: Record<string, unknown> = {};
      const back = new Map<string, string>();
      for (const [key, value] of Object.entries(original)) {
        if (key.startsWith("$")) {
          const safe = `odata_${key.slice(1)}`;
          if (safe in original) throw new Error(`odata key fix: ${safe} already exists`);
          renamed[safe] = value;
          back.set(safe, key);
        } else {
          renamed[key] = value;
        }
      }
      if (back.size > 0) {
        args[last - 1] = renamed;
        args[last] = (input: Record<string, unknown> | undefined, extra: unknown) => {
          const mapped: Record<string, unknown> = {};
          for (const [key, value] of Object.entries(input ?? {})) mapped[back.get(key) ?? key] = value;
          return (handler as AnyFn)(mapped, extra);
        };
      }
    }
    return register(...args);
  };
  (server as unknown as { tool: AnyFn }).tool = patched;
  return server;
}
