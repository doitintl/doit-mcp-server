import { TicketStatus } from "../common/types.js";
import { formatEnumValues, toSnakeCase } from "../utils/util.js";
import { deprecateBySnakeCaseNotice } from "./helpers.js";
import { legacyPrompts } from "./legacy.js";
import type { Prompt } from "./types.js";

const TOOL_LIST_TICKETS = "list_tickets";
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
