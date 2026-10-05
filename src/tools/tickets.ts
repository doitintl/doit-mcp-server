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
    pageToken: z
        .string()
        .optional()
        .describe("Page token from a previous response; keep the same pageSize when paging."),
    pageSize: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(40)
        .describe("Number of tickets per API page, from 1 to 100. Defaults to 40; sent as maxResults."),
    subject: z
        .string()
        .optional()
        .describe(
            "Case-insensitive substring filter on the returned API page only. Other pages are not searched. pageToken and rowCount retain the API's unfiltered page values, even when no tickets match."
        ),
});

// Tool definition
export const listTicketsTool = {
    name: "list_tickets",
    title: "List support tickets",
    coversEndpoint: "get:/support/v1/tickets",
    description:
        "Use this when the user wants to view their support tickets, check ticket status, or review open issues. Returns tickets with status, severity, and platform. Customers see their own tickets; organization tickets are visible when ticket sharing is enabled. Subject filtering is case-insensitive and applies only to the returned page. The API cursor and unfiltered rowCount are preserved, including on pages with no matches. Do NOT use this for cloud incidents (use get_cloud_incidents) or cost alerts (use list_alerts).",
    inputSchema: zodToMcpInputSchema(ListTicketsArgumentsSchema),
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
        params.append("maxResults", pageSize.toString());
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

// Arguments schema for creating a ticket
export const CreateTicketArgumentsSchema = z.object({
    ticket: z.object({
        body: z.string().describe("The body of the ticket (can include html formatting)"),
        created: z
            .string()
            .optional()
            .describe("Deprecated compatibility field. Ignored; the server sets the ticket creation time."),
        platform: z
            .nativeEnum(TicketPlatform)
            .describe("Support platform ID from list_platforms (id), rather than an asset type or display name."),
        product: z
            .string()
            .describe(
                "Support product ID from list_products (id) for the selected platform, rather than its display name."
            ),
        severity: z.nativeEnum(TicketSeverity).describe("Ticket severity: low, normal, high, or urgent."),
        subject: z.string().describe("The subject of the ticket."),
    }),
});

// Tool definition for creating a ticket
export const createTicketTool = {
    name: "create_ticket",
    title: "Create support ticket",
    coversEndpoint: "post:/support/v1/tickets",
    description:
        "Use this when the user wants to create a new support ticket. The ticket is opened with DoiT support immediately. Do NOT use this for viewing existing tickets (use list_tickets) or cloud incidents (use get_cloud_incidents).",
    inputSchema: zodToMcpInputSchema(CreateTicketArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        // `destructiveHint` is advisory per the MCP spec — clients are expected (but not
        // required) to surface a confirmation dialog. For a *server-enforced* confirmation
        // step, re-enable the WRITE_GATED_SUMMARIES entry in src/utils/toolsHandler.ts.
        destructiveHint: true,
        openWorldHint: true,
    },
    summary: (args: any) => {
        const ticket = args?.ticket ?? {};
        const severity = ticket.severity ? ` [${ticket.severity}]` : "";
        const platform = ticket.platform ? ` on ${ticket.platform}` : "";
        return `Create support ticket${severity}${platform}: "${ticket.subject ?? "<no subject>"}".`;
    },
    _meta: {
        "openai/toolInvocation/invoking": "Creating support ticket...",
        "openai/toolInvocation/invoked": "Ticket created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

// Handler for creating a ticket
export async function handleCreateTicketRequest(args: any, token: string) {
    try {
        const parsed = CreateTicketArgumentsSchema.parse(args);
        const { created: _created, ...ticket } = parsed.ticket;
        const { customerContext } = args;
        const url = TICKETS_BASE_URL;
        const response = await makeDoitRequest(url, token, {
            method: "POST",
            body: { ticket },
            customerContext,
            timeoutMs: 60_000,
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
    title: "Get support ticket",
    coversEndpoint: "get:/support/v1/tickets/{ticketId}",
    description: "Returns details of a specific support ticket from the DoiT API by its ID.",
    inputSchema: zodToMcpInputSchema(GetTicketArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
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
    title: "List ticket comments",
    coversEndpoint: "get:/support/v1/tickets/{ticketId}/comments",
    description:
        "Returns all comments on a support ticket. For customers, only public comments are returned. For DoiT employees, both public and private comments are returned.",
    inputSchema: zodToMcpInputSchema(ListTicketCommentsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
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

// Arguments schema for creating a ticket comment
export const CreateTicketCommentArgumentsSchema = z.object({
    ticketId: ListTicketCommentsArgumentsSchema.shape.ticketId.describe(
        "The numeric ID of the support ticket to add a comment to."
    ),
    body: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Comment body is required and cannot be empty or whitespace-only."))
        .describe("The text content of the comment (required, must be non-empty)."),
    private: z
        .boolean()
        .optional()
        .describe("If true, creates a private internal note. Only honored for DoiT employees; ignored for customers."),
});

// Tool definition for creating a ticket comment
export const createTicketCommentTool = {
    name: "create_ticket_comment",
    title: "Add ticket comment",
    coversEndpoint: "post:/support/v1/tickets/{ticketId}/comments",
    description:
        "Adds a comment to an existing support ticket. For customers, comments are always public. For DoiT employees, comments can be marked as private (internal notes) by setting the private field to true.",
    inputSchema: zodToMcpInputSchema(CreateTicketCommentArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Adding comment to ticket...",
        "openai/toolInvocation/invoked": "Comment added",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

// Handler for creating a ticket comment
export async function handleCreateTicketCommentRequest(args: any, token: string) {
    try {
        const { ticketId, ...rest } = CreateTicketCommentArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${TICKETS_BASE_URL}/${encodeURIComponent(ticketId)}/comments`;
        const data = await makeDoitRequest(url, token, {
            method: "POST",
            body: rest,
            customerContext,
        });
        if (!data) {
            return createErrorResponse("Failed to create ticket comment");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create ticket comment request");
    }
}
