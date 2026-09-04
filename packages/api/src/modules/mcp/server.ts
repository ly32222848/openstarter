// MCP server assembly: one stateless handler factory registering all tools.
//
// `createMcpHandler` builds a fresh McpServer per HTTP request (stateless,
// horizontally scalable). The factory receives the request context; tools
// resolve the caller via `authInfo.clientId`, which the router sets to the
// API-key owner's userId after validation.

import {
  createMcpHandler,
  type McpHttpHandler,
  McpServer,
  type McpRequestContext,
} from "@modelcontextprotocol/server";

import { registerChatTools } from "./tools/chats";
import { registerCommerceTools } from "./tools/orders";
import { registerProfileTools } from "./tools/profile";
import { registerTicketTools } from "./tools/tickets";

const SERVER_INFO = { name: "openstarter-mcp-server", version: "1.0.0" } as const;

export function buildMcpServer(ctx: McpRequestContext): McpServer {
  const server = new McpServer(SERVER_INFO);

  registerProfileTools(server);
  registerCommerceTools(server);
  registerChatTools(server);
  registerTicketTools(server);

  // Close over nothing user-specific — tools read the caller from the
  // per-request context so the factory stays side-effect free.
  void ctx;

  return server;
}

/** Web-standard (Request → Response) face the Hono router forwards to. */
export const mcpHandler: McpHttpHandler = createMcpHandler(buildMcpServer);
