import { TicketStatus } from "../common/types.js";
import { formatEnumValues, toSnakeCase } from "../utils/util.js";
import { deprecateBySnakeCaseNotice } from "./helpers.js";
import { legacyPrompts } from "./legacy.js";
import type { Prompt } from "./types.js";

const TOOL_LIST_TICKETS = "list_tickets";
const TOOL_LIST_PRODUCTS = "list_products";
const TOOL_LIST_PLATFORMS = "list_platforms";
const VALID_TICKET_STATUSES = formatEnumValues(Object.values(TicketStatus) as string[]);

const PLATFORM_PRODUCT_RESOLUTION = `If platform or product criteria are provided, first call related tool (for platform \`${TOOL_LIST_PLATFORMS}\` and for product \`${TOOL_LIST_PRODUCTS}\`) to retrieve the available values, then find the closest matching platform or product to what the user entered before applying the filter. If the provided platform or product does not match to the tool results, ignore those provided values and skip matching/searching based on them, but inform the user at the end about the invalid product/platform value`;
const EXPERT_INQUIRY_TERMINOLOGY_GUIDE =
    "Use the term 'expert inquiry' to refer to a ticket or 'expert inquiries' to refer to tickets in messages";

const EXPERT_INQUIRIES_PROMPT_TEXT = `List recent expert inquiries from the DoiT support API by calling the \`${TOOL_LIST_TICKETS}\` tool. First list the tickets with the specified status if provided, otherwise status that is not \`closed\`, show the list maximum of 20 tickets, or the limit argument if specified. If more specific criteria like platform or product are provided, show tickets that match the criteria first, followed by a brief summary of the rest. ${PLATFORM_PRODUCT_RESOLUTION} ${EXPERT_INQUIRY_TERMINOLOGY_GUIDE}`;
const SEARCH_EXPERT_INQUIRIES_PROMPT_TEXT = `Search expert inquiries from the DoiT support API by calling the \`${TOOL_LIST_TICKETS}\` tool with a pageSize=100 to retrieve a set of results. Search through the returned tickets, to find tickets where subject or body matches the provided keyword. If platform or product are provided, further narrow the matches to tickets related to those criteria. ${PLATFORM_PRODUCT_RESOLUTION} Present the matching expert inquiries prominently. If no match found, call the tool again page by page (using pageToken) to fetch more results until a match found or no more results. Do not retrieve more than 5 pages in a single response. If you reach this limit and still want to search further, first ask the user for explicit confirmation before continuing with additional pages. At the end, include a brief summary with statistics about the full set of tickets searched (e.g. total retrieved, how many matched, ticket status breakdown). ${EXPERT_INQUIRY_TERMINOLOGY_GUIDE}`;

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
        messages: [{ role: "user", text: EXPERT_INQUIRIES_PROMPT_TEXT }],
        arguments: [
            { name: "status", description: `Optional, status (${VALID_TICKET_STATUSES})` },
            { name: "platform", description: "Optional, related platform" },
            { name: "product", description: "Optional, related product" },
            { name: "limit", description: "Optional, number of items" },
        ],
    },
    {
        name: "search_expert_inquiries",
        description: "Search DoiT expert inquiries by keyword, optionally filtered by platform and product",
        messages: [{ role: "user", text: SEARCH_EXPERT_INQUIRIES_PROMPT_TEXT }],
        arguments: [
            { name: "keyword", description: "Keyword to search for in ticket subject and body", required: true },
            { name: "platform", description: "Optional, filter matches by related platform" },
            { name: "product", description: "Optional, filter matches by related product" },
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
