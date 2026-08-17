import excludedOperations from "./excludedOperations.json" with { type: "json" };

/**
 * Policy layer over the auto-generated tools: operations listed in
 * excludedOperations.json are never exposed as MCP tools, even though they exist
 * in the bundled OpenAPI snapshot. Keyed the same way as COVERED_ENDPOINTS
 * ("method:/path/template", lowercased) so the three sets — covered, excluded,
 * generated — partition the spec exactly.
 */
export const EXCLUDED_ENDPOINTS: Set<string> = new Set(
    excludedOperations.excludedEndpoints.map((entry) => entry.endpoint.toLowerCase())
);

export const EXCLUDED_TAGS: Set<string> = new Set(
    excludedOperations.excludedTags.map((tag: string) => tag.toLowerCase())
);

export function isExcludedOperation(method: string, pathTemplate: string, tags: string[] = []): boolean {
    if (EXCLUDED_ENDPOINTS.has(`${method}:${pathTemplate}`.toLowerCase())) return true;
    return tags.some((tag) => EXCLUDED_TAGS.has(tag.toLowerCase()));
}
