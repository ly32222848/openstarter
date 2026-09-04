// MCP module entry: Hono router + barrel exports.
//
// Endpoint: POST/GET /api/mcp (streamable HTTP, stateless). Access is API-key
// only (`apiKeyAuth`) — browser sessions must not reach the transport. The
// resolved userId travels to tools as `authInfo.clientId`.

import { Hono } from "hono";

import { apiKeyAuth } from "../../middleware/auth";
import { mcpHandler } from "./server";

export const mcpRouter = new Hono().all("/", apiKeyAuth, async (c) => {
  const userId = c.get("userId");
  return mcpHandler.fetch(c.req.raw, {
    authInfo: { clientId: userId, scopes: ["mcp"], token: "" },
  });
});

export { buildMcpServer, mcpHandler } from "./server";
export { resolveUserId } from "./shared";
