import { TicketPlatform, TicketSeverity } from "../common/types.js";
import { formatEnumValues, toSnakeCase } from "../utils/util.js";
import { deprecateBySnakeCaseNotice } from "./helpers.js";
import { legacyPrompts } from "./legacy.js";
import type { Prompt } from "./types.js";

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
                text: "List recent expert inquiries from the DoiT support API by calling the `list_tickets` tool. First list the tickets with the specified status if provided, otherwise status that is not `closed`, show the list maximum of 20 or the limit argument, if specified. If filters such as platform, product, or keyword are provided, show tickets that contain the keyword in subject or body first, followed by a brief summary of the rest. Use the term 'expert inquiries' to refer to tickets in messages",
            },
        ],
        arguments: [
            { name: "status", description: "Enquiry status (open, new, pending, hold, closed, solved)" },
            { name: "platform", description: "Related cloud platform" },
            { name: "product", description: "Related product" },
            {
                name: "keyword",
                description: "keywords in the subject or body of the inquiry",
            },
            { name: "limit", description: "Number of inquiries to return" },
        ],
    },
    {
        name: "create_expert_inquiry",
        description: "Create a new DoiT expert inquiry with the specified details",
        messages: [
            {
                role: "user",
                text: `Create a new expert inquiry using the DoiT support API by calling the \`create_ticket\` tool. Use the provided subject, body, platform and severity to create the inquiry. If severity is not specified, default to '${TicketSeverity.NORMAL}'. Use tool 'list_platforms' for a list of valid platforms, then use tool 'list_products' to get a list of products for the chosen latform and request the user to specify a product. The valid severities are: ${formatEnumValues(Object.values(TicketSeverity))}. Use the term 'expert inquiry' to refer to tickets in messages. Before creating the expert inquiry, confirm the creation and after creation show the inquiry details including its ID and URL.`,
            },
        ],
        arguments: [
            { name: "subject", description: "Subject of the expert inquiry", required: true },
            { name: "body", description: "Detailed description of the expert inquiry", required: true },
            {
                name: "platform",
                description: `Related cloud platform (${formatEnumValues(Object.values(TicketPlatform))})`,
                required: true,
            },
            {
                name: "severity",
                description: `Inquiry severity (${formatEnumValues(Object.values(TicketSeverity))})`,
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
