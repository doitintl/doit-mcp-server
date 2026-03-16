import { TicketSeverity, TicketStatus } from "../common/types.js";
import { formatEnumValues, toSnakeCase } from "../utils/util.js";
import { deprecateBySnakeCaseNotice } from "./helpers.js";
import { legacyPrompts } from "./legacy.js";
import type { Prompt } from "./types.js";

const TOOL_LIST_PLATFORMS = "list_platforms";
const TOOL_LIST_PRODUCTS = "list_products";
const TOOL_LIST_TICKETS = "list_tickets";
const TOOL_CREATE_TICKET = "create_ticket";
const DEFAULT_TICKET_SEVERITY = TicketSeverity.NORMAL;
const VALID_TICKET_SEVERITIES = formatEnumValues(Object.values(TicketSeverity));
const VALID_TICKET_STATUSES = formatEnumValues(Object.values(TicketStatus));

/**
 * The canonical prompts defined by the MCP server, using snake_case names only.
 *
 * NOTE: New prompts should be added directly to this array using snake_case names,
 * e.g. { name: "my_new_prompt", description: "...", text: "..." }
 */
const canonicalPrompts: Prompt[] = [
    {
        name: "expert_inquiries",
        description: "List recent DoiT expert inquiries, optionally filtered locally by specified criteria",
        messages: [
            {
                role: "user",
                text: `List recent expert inquiries from the DoiT support API by calling the \`${TOOL_LIST_TICKETS}\` tool. First list the tickets with the specified status if provided, otherwise status that is not \`closed\`, show the list maximum of 20 ticket, or the limit argument if specified. If more specific criteria like platform or product are provided, show tickets that match the criteria first, followed by a brief summary of the rest. Use the term 'expert inquiries' to refer to tickets in messages`,
            },
        ],
        arguments: [
            { name: "status", description: `Optional, status (${VALID_TICKET_STATUSES})` },
            { name: "platform", description: "Optional, related platform" },
            { name: "product", description: "Optional, related product" },
            { name: "limit", description: "Optional, number of items" },
        ],
    },
    {
        name: "create_expert_inquiry",
        description: "Create a new DoiT expert inquiry with the specified details",
        messages: [
            {
                role: "user",
                text: `Create a new expert inquiry using the DoiT support API. Follow these steps in order:
1. Call the \`${TOOL_LIST_PLATFORMS}\` tool to get the list of valid platforms and ask the user to choose a platform.
2. Once the user has chosen a platform, call the \`${TOOL_LIST_PRODUCTS}\` tool for the chosen platform to get the list of products and ask the user to choose a product.
3. Ask the user for the body (detailed description) of the expert inquiry.
4. Confirm the expert inquiry details with the user before creating it.
5. Call the \`${TOOL_CREATE_TICKET}\` tool to create the expert inquiry.
6. After creation, show the expert inquiry details including its ID and URL.
The valid severities are: ${VALID_TICKET_SEVERITIES}. If severity is not specified, default to '${DEFAULT_TICKET_SEVERITY}'. Use the term 'expert inquiry' to refer to tickets in messages.`,
            },
        ],
        arguments: [
            { name: "subject", description: "Subject of the expert inquiry", required: true },
            {
                name: "severity",
                description: `Inquiry severity (${VALID_TICKET_SEVERITIES})`,
            },
        ],
    },
];

/**
 * The exported list of prompts exposed by the MCP server, using snake_case names only.
 *
 * NOTE: New prompts should be added directly to canonicalPrompts array,
 * this is a way to keep exporting legacy prompts until deprecated.
 */
export const prompts: Prompt[] = [
    ...canonicalPrompts,
    ...legacyPrompts.map((p) => ({ ...p, name: toSnakeCase(p.name) })),
];

/**
 * Extends `prompts` with the original human-readable names of legacy prompts for
 * backward compatibility. Use this only where clients may still refer to prompts
 * by their old human-readable names.
 */
export const promptsIncludingLegacyNames: Prompt[] = [...prompts, ...legacyPrompts.map(deprecateBySnakeCaseNotice)];
