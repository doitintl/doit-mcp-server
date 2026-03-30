import { z } from "zod";
import { TicketPlatform, TicketSeverity } from "../common/types.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const TICKETS_BASE_URL = `${DOIT_API_BASE}/support/v1/tickets`;

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
    pageSize: z.number().optional().describe("Number of tickets to return per page"),
    subject: z
        .string()
        .optional()
        .describe(
            "Partial subject filter (case-insensitive). Returns only tickets whose subject contains this string."
        ),
});

// Tool definition
export const listTicketsTool = {
    name: "list_tickets",
    description:
        "Use this when the user wants to view their support tickets, check ticket status, or review open issues. Returns tickets with status, priority, and platform. Supports partial subject filtering. Do NOT use this for cloud incidents (use get_cloud_incidents) or cost alerts (use list_alerts).",
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
            subject: {
                type: "string",
                description:
                    "Partial subject filter (case-insensitive). Returns only tickets whose subject contains this string.",
            },
        },
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading support tickets...",
        "openai/toolInvocation/invoked": "Tickets loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// Handler for the tool
export async function handleListTicketsRequest(args: any, token: string) {
    try {
        const { customerContext } = args;
        const { subject, pageToken, pageSize } = ListTicketsArgumentsSchema.parse(args);
        const params = new URLSearchParams();
        if (pageToken) params.append("pageToken", pageToken);
        if (pageSize) params.append("pageSize", pageSize.toString());
        const url = `${TICKETS_BASE_URL}?${params.toString()}`;
        const data = await makeDoitRequest<TicketsResponse>(url, token, {
            method: "GET",
            customerContext,
        });
        if (!data) {
            return createErrorResponse("Failed to fetch tickets: No data returned");
        }
        if (subject) {
            const q = subject.toLowerCase();
            data.tickets = (data.tickets ?? []).filter(
                (t) => typeof t.subject === "string" && t.subject.toLowerCase().includes(q)
            );
        }
        return createSuccessResponse(JSON.stringify(data));
    } catch (error) {
        return handleGeneralError(error, "listing tickets");
    }
}

// Tool definition for creating a ticket
export const createTicketTool = {
    name: "create_ticket",
    description:
        "Use this when the user wants to create a new support ticket. Ask the user to confirm the ticket details before executing. Do NOT use this for viewing existing tickets (use list_tickets) or cloud incidents (use get_cloud_incidents).",
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
                        enum: Object.values(TicketPlatform),
                    },
                    product: {
                        type: "string",
                        description: "Ticket product details",
                    },
                    severity: {
                        type: "string",
                        description: "Ticket severity",
                        enum: Object.values(TicketSeverity),
                    },
                    subject: {
                        type: "string",
                        description: "The subject of the ticket.",
                    },
                },
                required: ["body", "created", "platform", "product", "severity", "subject"],
            },
        },
        required: ["ticket"],
    },
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Creating support ticket...",
        "openai/toolInvocation/invoked": "Ticket created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

// Arguments schema for creating a ticket
export const CreateTicketArgumentsSchema = z.object({
    ticket: z.object({
        body: z.string(),
        created: z.string(),
        platform: z.nativeEnum(TicketPlatform),
        product: z.string(),
        severity: z.nativeEnum(TicketSeverity),
        subject: z.string(),
    }),
});

// Handler for creating a ticket
export async function handleCreateTicketRequest(args: any, token: string) {
    try {
        const parsed = CreateTicketArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = TICKETS_BASE_URL;
        const response = await makeDoitRequest(url, token, {
            method: "POST",
            body: { ticket: parsed.ticket },
            customerContext,
        });
        if (!response) {
            return createErrorResponse("Failed to create ticket: No data returned");
        }
        return createSuccessResponse(JSON.stringify(response));
    } catch (error) {
        return handleGeneralError(error, "creating ticket");
    }
}
