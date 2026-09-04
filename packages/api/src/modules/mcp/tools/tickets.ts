// Support-ticket MCP tools: read the caller's threads; create/reply as the user.
//
// This is the only write surface exposed over MCP. Writes go through the
// existing tickets service with `role` pinned to `user` — an API key can
// never post as an admin. Ownership is verified before any cross-ticket read
// or append; other users' ticket ids are indistinguishable from unknown ids.

import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";

import {
  addMessage,
  createTicket,
  getTicketById,
  getTicketMessages,
  listUserTickets,
  TICKET_ROLE,
  TICKET_STATUS_VALUES,
} from "../../support/tickets/service";
import {
  jsonContent,
  paginationSchema,
  resolveUserId,
  toIsoString,
  withToolError,
} from "../shared";

const READ_ONLY = {
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
  readOnlyHint: true,
} as const;

const NOT_FOUND_MESSAGE =
  "Ticket was not found for this account. Call openstarter_list_tickets to get valid ticket ids.";

const MAX_TITLE_LENGTH = 200;
const MAX_CONTENT_LENGTH = 5000;

const listTicketsSchema = paginationSchema.extend({
  status: z.enum(TICKET_STATUS_VALUES).optional().describe("Filter by ticket status."),
  search: z.string().min(1).max(200).optional().describe("Search within ticket titles."),
});

const createTicketSchema = z.object({
  title: z.string().min(1).max(MAX_TITLE_LENGTH).describe("Short summary of the issue."),
  content: z
    .string()
    .min(1)
    .max(MAX_CONTENT_LENGTH)
    .describe("Full description of the issue; posted as the first message."),
});

const ticketIdSchema = z.object({
  ticketId: z.string().min(1).describe("Id of the ticket (from openstarter_list_tickets)."),
});

const replyTicketSchema = ticketIdSchema.extend({
  content: z
    .string()
    .min(1)
    .max(MAX_CONTENT_LENGTH)
    .describe("Reply content; appended to the ticket thread."),
});

export function registerTicketTools(server: McpServer): void {
  server.registerTool(
    "openstarter_list_tickets",
    {
      description:
        "List the authenticated user's support tickets, most recently active first, with pagination and optional status/search filters. Each entry includes id, title, status, and a preview of the latest admin reply.",
      inputSchema: listTicketsSchema,
      annotations: READ_ONLY,
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const { items, total } = await listUserTickets({
          page: args.page,
          pageSize: args.pageSize,
          search: args.search,
          status: args.status,
          userId,
        });
        return jsonContent({
          items: items.map((item) => ({
            createdAt: toIsoString(item.createdAt),
            id: item.id,
            latestReply: item.latestReply,
            status: item.status,
            title: item.title,
            updatedAt: toIsoString(item.updatedAt),
          })),
          page: args.page,
          pageSize: args.pageSize,
          total,
        });
      }),
  );

  server.registerTool(
    "openstarter_get_ticket_messages",
    {
      description:
        "Read the full message thread of one of the authenticated user's support tickets, oldest first. Messages include sender role and content.",
      inputSchema: ticketIdSchema,
      annotations: READ_ONLY,
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const ticket = await getTicketById(args.ticketId);
        if (!ticket || ticket.userId !== userId) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: NOT_FOUND_MESSAGE }],
          };
        }

        const messages = await getTicketMessages(args.ticketId);
        return jsonContent({
          items: messages.map((message) => ({
            content: message.content,
            createdAt: toIsoString(message.createdAt),
            id: message.id,
            role: message.role,
          })),
          status: ticket.status,
          ticketId: ticket.id,
          title: ticket.title,
        });
      }),
  );

  server.registerTool(
    "openstarter_create_ticket",
    {
      description:
        "Create a new support ticket on behalf of the authenticated user. The content becomes the first message of the thread; the ticket starts in the 'open' state.",
      inputSchema: createTicketSchema,
      annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const created = await createTicket({
          content: args.content.trim(),
          title: args.title.trim(),
          userId,
        });
        return jsonContent({
          createdAt: toIsoString(created.createdAt),
          id: created.id,
          status: created.status,
          title: created.title,
        });
      }),
  );

  server.registerTool(
    "openstarter_reply_ticket",
    {
      description:
        "Append a reply to one of the authenticated user's support tickets (reopens it if it was closed). Only replies as the user — admin replies are not possible over MCP.",
      inputSchema: replyTicketSchema,
      annotations: { destructiveHint: false, openWorldHint: false, readOnlyHint: false },
    },
    (args, extra) =>
      withToolError(async () => {
        const userId = resolveUserId(extra);
        const ticket = await getTicketById(args.ticketId);
        if (!ticket || ticket.userId !== userId) {
          return {
            isError: true as const,
            content: [{ type: "text" as const, text: NOT_FOUND_MESSAGE }],
          };
        }

        const message = await addMessage({
          content: args.content.trim(),
          role: TICKET_ROLE.USER,
          ticketId: ticket.id,
          userId,
        });
        return jsonContent({
          createdAt: toIsoString(message.createdAt),
          id: message.id,
          role: message.role,
          ticketId: message.ticketId,
        });
      }),
  );
}
