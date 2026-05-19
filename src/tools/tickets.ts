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
    /**
     * Approval payload for the `create_ticket` write gate. Returns both:
     *   - `summary`: a multi-line block (one-sentence header + "More details below:"
     *     transition + an indented Platform/Product/Severity/Subject/Body table). The
     *     LLM is instructed to render this verbatim so the user can verify every field.
     *   - `userPrompt`: the short yes/no question the LLM asks AFTER showing summary.
     *     Tool-specific so we can phrase it naturally ("with the above details") rather
     *     than restating the entire header.
     *
     * Values in the header are double-quoted so they're visually distinct from the
     * surrounding prose (`with severity "high" on platform "aws"`).
     */
    summary: (args: any): { summary: string; userPrompt: string } => {
        const ticket = args?.ticket ?? {};
        const parts: string[] = ["Create support ticket"];
        if (ticket.severity) parts.push(`with severity "${ticket.severity}"`);
        if (ticket.platform) parts.push(`on platform "${ticket.platform}"`);
        if (ticket.subject) parts.push(`with subject "${ticket.subject}"`);
        const header = `${parts.join(" ")}.`;

        const rows: Array<[string, string | undefined]> = [
            ["Platform", ticket.platform],
            ["Product", ticket.product],
            ["Severity", ticket.severity],
            ["Subject", ticket.subject],
            ["Body", ticket.body],
        ];
        const details = rows
            .filter(([, v]) => typeof v === "string" && v.length > 0)
            .map(([k, v]) => `  ${k.padEnd(8)}: ${v}`)
            .join("\n");

        if (!details) {
            // No fields to enumerate (defensive): fall back to a derived yes/no off the
            // header alone, so the LLM still has a sensible question to ask.
            const body = header.replace(/[.!?]+\s*$/, "");
            return {
                summary: header,
                userPrompt: `Are you sure you want to ${body.charAt(0).toLowerCase()}${body.slice(1)}?`,
            };
        }
        return {
            summary: `${header} More details below:\n${details}`,
            userPrompt: "Are you sure you want to create the support ticket with the above details?",
        };
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
        const response = await makeDoitRequest<Partial<Ticket>>(url, token, {
            method: "POST",
            body: { ticket: parsed.ticket },
            customerContext,
        });
        if (!response) {
            return createErrorResponse("Failed to create ticket: No data returned");
        }
        return createSuccessResponse(formatCreatedTicket(response));
    } catch (error) {
        return handleGeneralError(error, "creating ticket");
    }
}

/**
 * Renders the create-ticket API response as a markdown block that surfaces the ticket
 * URL prominently, alongside the full JSON payload. We include both because:
 *   - The markdown header is what shows in chat clients (Claude Desktop / ChatGPT) —
 *     a clickable link is the action the user actually wants right now.
 *   - The JSON tail keeps the structured fields available so the LLM can still answer
 *     follow-up questions ("what's the ticket id?", "what severity did it get?")
 *     without another API round-trip.
 */
function formatCreatedTicket(response: Partial<Ticket>): string {
    const url = response.urlUI;
    const id = response.id;
    const subject = response.subject ?? "(no subject)";
    const headerLine = id !== undefined ? `Ticket #${id} created: ${subject}` : `Ticket created: ${subject}`;
    const linkLine = url ? `\nView ticket: ${url}` : "";
    return `${headerLine}${linkLine}\n\n${JSON.stringify(response)}`;
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
    description:
        "Returns all comments on a support ticket. For customers, only public comments are returned. For DoiT employees, both public and private comments are returned.",
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
    description:
        "Adds a comment to an existing support ticket. For customers, comments are always public. For DoiT employees, comments can be marked as private (internal notes) by setting the private field to true.",
    inputSchema: zodToMcpInputSchema(CreateTicketCommentArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: false,
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
