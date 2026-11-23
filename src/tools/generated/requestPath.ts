import { z } from "zod";

import { hasTraversalSegment } from "../../utils/util.js";
import type { OperationMetadata } from "./types.js";

// Never sent anywhere: only used to run the request path through the same WHATWG URL
// parser fetch applies, so a path that parser would rewrite is caught before sending.
const PATH_CHECK_ORIGIN = "https://path-check.invalid";

function invalidPathParam(name: string, value: string, message: string): z.ZodError {
    return new z.ZodError([{ code: "custom", path: [name], message, input: value }]);
}

/**
 * Validates that a path parameter value occupies a single non-empty, non-traversal path
 * segment, rejecting empty strings, raw dot segments (`.`/`..`), slash/backslash dot
 * segments, and percent-encoded dot segments (`%2e%2e`, `%252e%252e`, `a%2f..%2fb`).
 */
export function validatePathSegment(paramName: string, raw: unknown): string {
    const value = raw === undefined || raw === null ? "" : String(raw);
    if (value === "" || hasTraversalSegment(value)) {
        throw invalidPathParam(paramName, value, "must be a non-empty identifier with no '.' or '..' segments");
    }
    return value;
}

/**
 * Substitutes path params into the operation's pathTemplate. Each value must occupy exactly
 * one opaque, non-empty path segment: encodeURIComponent leaves `.` unencoded, so a value of
 * `.` or `..` would become a dot segment that fetch's URL parser resolves away — sending the
 * call to a sibling endpoint (e.g. `/users/../geographic-scope` → the customer-wide scope)
 * while the tool name and approval summary describe the narrower one.
 *
 * Shared by the request executor and the approval summary, so what the user confirms
 * is the path that is sent. Throws a ZodError so both callers report a validation error.
 */
export function buildRequestPath(
    metadata: Pick<OperationMetadata, "pathTemplate" | "pathParams">,
    values: Record<string, unknown>
): string {
    let requestPath = metadata.pathTemplate;
    for (const paramName of metadata.pathParams) {
        const value = validatePathSegment(paramName, values?.[paramName]);
        requestPath = requestPath.replace(`{${paramName}}`, encodeURIComponent(value));
    }

    if (new URL(requestPath, PATH_CHECK_ORIGIN).pathname !== requestPath) {
        throw invalidPathParam(
            metadata.pathParams[0] ?? "path",
            requestPath,
            `resolves to a different path than ${metadata.pathTemplate}`
        );
    }
    return requestPath;
}
