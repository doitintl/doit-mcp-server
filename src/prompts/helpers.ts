import { toSnakeCase } from "../utils/util.js";
import type { Prompt, PromptMessage } from "./types.js";

/**
 * Returns the names of required prompt arguments that are absent from the provided args map.
 */
export function getPromptMissingArgs(prompt: Prompt, args: Record<string, string | number>): string[] {
    return (prompt.arguments ?? [])
        .filter((a) => a.required)
        .filter((a) => args[a.name] === undefined || args[a.name] === "")
        .map((a) => a.name);
}

/**
 * Filter raw request arguments to only the keys declared on the prompt and
 * drop any entry whose value is an empty string.
 *
 * @param prompt - the prompt definition whose `arguments` list is the allowlist
 * @param args - the raw key-value map supplied by the caller
 * @returns a new object containing only the allowed, non-empty-string entries
 */
export function filterPromptArgs(prompt: Prompt, args: Record<string, unknown>): Record<string, unknown> {
    const declared = new Set((prompt.arguments ?? []).map((a) => a.name));
    return Object.fromEntries(Object.entries(args).filter(([key, value]) => declared.has(key) && value !== ""));
}

/**
 * Apply argument substitution to prompt messages by appending the provided
 * key-value pairs as a block after the last message.
 *
 * @param messages - the list of prompt messages to process
 * @param args - record of argument names to values
 * @returns a new list of messages with the argument block appended to the last message
 */
export function applyPromptMessageArguments(messages: PromptMessage[], args: Record<string, unknown>): PromptMessage[] {
    if (messages.length === 0) return messages;

    const entries = Object.entries(args);
    if (entries.length === 0) return messages;

    const lines = entries
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => {
            const serialized = typeof value === "object" ? JSON.stringify(value, null, 2) : String(value);
            return `${key}: ${serialized}`;
        });

    if (lines.length === 0) return messages;

    const block = lines.join("\n");
    const result = messages.map((m) => ({ ...m }));
    const last = result.length - 1;
    result[last] = { role: result[last].role, text: `${result[last].text}\n\n${block}` };

    return result;
}

/**
 * Resolve the prompt messages for a prompt definition (into a list of messages as expected by the MCP protocol),
 * translating single message prompts to multi message prompts.
 *
 * @param prompt - the prompt definition
 * @returns the list of messages as expected by the MCP protocol
 */
export function resolvePromptMessages(prompt: Prompt): PromptMessage[] {
    if (prompt.messages) return prompt.messages;
    return [{ role: prompt.role ?? "user", text: prompt.text }];
}

/**
 * Returns a copy of the prompt with a deprecation notice appended to its description,
 * directing users to the snake_case version of the prompt name.
 */
export function deprecateBySnakeCaseNotice(prompt: Prompt): Prompt {
    const snakeCaseName = toSnakeCase(prompt.name);
    const deprecationSuffix = ` [DEPRECATED: Please use '${snakeCaseName}' instead]`;
    return {
        ...prompt,
        description: `${prompt.description}${deprecationSuffix}`,
    };
}
