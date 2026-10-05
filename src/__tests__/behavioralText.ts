/**
 * Shared by the stdio tools/list check and the core Zod schema check: directory review (e.g. the
 * Claude Connectors Directory) rejects tool text that tells the model how to behave — always
 * calling other tools, asking the user, what it may claim, or how to fill a parameter.
 */
export const BEHAVIORAL_TEXT =
    /\bALWAYS\b|\bAlways (call|use|include|export)\b|\bIMPORTANT\b|Ask the user|before reporting|Only claim|proactively|Only call this|\b(should|must) (call|present|ask|tell|respond|reply)\b|[Dd]o not guess|only if you know/;

/** Every description in a JSON Schema, keyed by property path, recursively. */
export function schemaDescriptions(schema: any, path: string): [string, string][] {
    if (!schema || typeof schema !== "object") return [];
    const own: [string, string][] = typeof schema.description === "string" ? [[path, schema.description]] : [];
    const nested = [
        ...Object.entries(schema.properties ?? {}).map(([key, value]) => schemaDescriptions(value, `${path}.${key}`)),
        schemaDescriptions(schema.items, `${path}[]`),
        ...[...(schema.anyOf ?? []), ...(schema.oneOf ?? []), ...(schema.allOf ?? [])].map((alt) =>
            schemaDescriptions(alt, path)
        ),
    ].flat();
    return [...own, ...nested];
}
