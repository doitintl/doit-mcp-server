import { toSnakeCase } from "../utils/util.js";
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
        description: "View latest DoIT expert inquiries",
        messages: [
            {
                role: "user",
                text: "List latest open expert inquiries by listing my last few support request ticket from DoiT API with status=open. If user has provided some criteria like platform or product, or subject keyword, first fetch the list and show those tickets matching the keyword first, then a summary of others",
            },
        ],
        arguments: [
            { name: "platform", description: "The cloud platform the inquiry is related to" },
            { name: "product", description: "The product the inquiry is related to" },
            {
                name: "keyword",
                description: "Keywords in the subject or the body of the ticket to filter the inquiries",
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
