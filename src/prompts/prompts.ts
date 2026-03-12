import { toSnakeCase } from "../utils/util.js";
import { deprecateBySnakeCaseNotice } from "./helpers.js";
import { legacyPrompts } from "./legacy.js";
import type { Prompt } from "./types.js";

/**
 * The canonical list of prompts exposed by the MCP server, using snake_case names only.
 *
 * NOTE: New prompts should be added directly to this array using snake_case names,
 * e.g. { name: "my_new_prompt", description: "...", text: "..." }
 */
const canonicalPrompts: Prompt[] = [];

/**
 * The canonical list of prompts exposed by the MCP server, using snake_case names only.
 *
 * NOTE: New prompts should be added directly to canonicalPrompts array, which
 * is used to generate the promptsIncludingLegacyNames array.
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
