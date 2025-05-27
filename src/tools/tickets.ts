import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  handleGeneralError,
  makeDoitRequest,
} from "../utils/util.js";

// Ticket interface matching the API response
export interface Ticket {
  createTime: number;
  id: number;
  is_public: boolean;
  platform: string;
  product: string;
  requester: string;
  severity: string;
  status: string;
  subject: string;
  updateTime: number;
  urlUI: string;
}

export interface TicketsResponse {
  pageToken?: string;
  rowCount: number;
  tickets: Ticket[];
}

// Arguments schema for listing tickets
export const ListTicketsArgumentsSchema = z.object({
  pageToken: z.string().optional().describe("Page token for pagination"),
  pageSize: z
    .number()
    .optional()
    .describe("Number of tickets to return per page"),
});

// Tool definition
export const listTicketsTool = {
  name: "list_tickets",
  description: "List support tickets from DoiT using the support API.",
  inputSchema: {
    type: "object",
    properties: {
      pageToken: {
        type: "string",
        description: "Page token for pagination",
      },
      pageSize: {
        type: "number",
        description: "Number of tickets to return per page",
      },
    },
  },
};

// Handler for the tool
export async function handleListTicketsRequest(args: any, token: string) {
  try {
    const params = new URLSearchParams();
    if (args.pageToken) params.append("pageToken", args.pageToken);
    if (args.pageSize) params.append("pageSize", args.pageSize.toString());
    const url = `https://api.doit.com/support/v1/tickets?${params.toString()}`;
    const data = await makeDoitRequest<TicketsResponse>(url, token);
    if (!data) {
      return createErrorResponse("Failed to fetch tickets: No data returned");
    }
    return createSuccessResponse(JSON.stringify(data));
  } catch (error) {
    return handleGeneralError(error, "listing tickets");
  }
}

// Tool definition for creating a ticket
export const createTicketTool = {
  name: "create_ticket",
  description: "Create a new support ticket in DoiT using the support API.",
  inputSchema: {
    type: "object",
    properties: {
      ticket: {
        type: "object",
        properties: {
          body: {
            type: "string",
            description: "The body of the ticket (can include html formatting)",
          },
          created: {
            type: "string",
            description: "Ticket create time",
          },
          platform: {
            type: "string",
            description: "Platform of the ticket",
            enum: [
              "doit",
              "google_cloud_platform",
              "amazon_web_services",
              "microsoft_azure",
            ],
          },
          product: {
            type: "string",
            description: "Ticket product details",
          },
          severity: {
            type: "string",
            description: "Ticket severity",
            enum: ["low", "normal", "high", "urgent"],
          },
          subject: {
            type: "string",
            description: "The subject of the ticket.",
          },
        },
        required: [
          "body",
          "created",
          "platform",
          "product",
          "severity",
          "subject",
        ],
      },
    },
    required: ["ticket"],
  },
};

// Handler for creating a ticket
export async function handleCreateTicketRequest(args: any, token: string) {
  try {
    const url = `https://api.doit.com/support/v1/tickets`;
    const response = await makeDoitRequest(url, token, {
      method: "POST",
      body: { ticket: args.ticket },
    });
    if (!response) {
      return createErrorResponse("Failed to create ticket: No data returned");
    }
    return createSuccessResponse(JSON.stringify(response));
  } catch (error) {
    return handleGeneralError(error, "creating ticket");
  }
}
