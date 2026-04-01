import { z } from "zod";
import { TicketPlatform, TicketSeverity } from "../common/types.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
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
        const { customerContext } = args;
        const params = new URLSearchParams();
        if (args.pageToken) params.append("pageToken", args.pageToken);
        if (args.pageSize) params.append("pageSize", args.pageSize.toString());
        const url = `${TICKETS_BASE_URL}?${params.toString()}`;
        const data = await makeDoitRequest<TicketsResponse>(url, token, {
            customerContext,
        });
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
        const { customerContext } = args;
        const url = TICKETS_BASE_URL;
        const response = await makeDoitRequest(url, token, {
            method: "POST",
            body: { ticket: args.ticket },
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

// Arguments schema for getting a single ticket
export const GetTicketArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(
            z
                .string()
                .min(1, "Ticket ID is required and cannot be empty.")
                .regex(/^\d+$/, "Ticket ID must be a numeric value.")
        )
        .describe("The numeric ID of the support ticket to retrieve."),
});

// Tool definition for getting a single ticket
export const getTicketTool = {
    name: "get_ticket",
    description: "Returns details of a specific support ticket from the DoiT API by its ID.",
    inputSchema: zodToMcpInputSchema(GetTicketArgumentsSchema),
};

// Handler for getting a single ticket
export async function handleGetTicketRequest(args: any, token: string) {
    try {
        const { id } = GetTicketArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${TICKETS_BASE_URL}/${encodeURIComponent(id)}`;
        const data = await makeDoitRequest(url, token, {
            method: "GET",
            customerContext,
        });
        if (!data) {
            return createErrorResponse("Failed to retrieve ticket");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get ticket request");
    }
}

// Arguments schema for listing ticket comments
export const ListTicketCommentsArgumentsSchema = z.object({
    ticketId: z
        .string()
        .transform((val) => val.trim())
        .pipe(
            z
                .string()
                .min(1, "Ticket ID is required and cannot be empty.")
                .regex(/^\d+$/, "Ticket ID must be a numeric value.")
        )
        .describe("The numeric ID of the support ticket whose comments to retrieve."),
});

// Tool definition for listing ticket comments
export const listTicketCommentsTool = {
    name: "list_ticket_comments",
    description: "Returns all comments on a support ticket. For customers, only public comments are returned. For DoiT employees, both public and private comments are returned.",
    inputSchema: zodToMcpInputSchema(ListTicketCommentsArgumentsSchema),
};

// Handler for listing ticket comments
export async function handleListTicketCommentsRequest(args: any, token: string) {
    try {
        const { ticketId } = ListTicketCommentsArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${TICKETS_BASE_URL}/${encodeURIComponent(ticketId)}/comments`;
        const data = await makeDoitRequest(url, token, {
            method: "GET",
            customerContext,
        });
        if (!data) {
            return createErrorResponse("Failed to retrieve ticket comments");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list ticket comments request");
    }
}
