import type { OpenAPIV3 } from "openapi-types";
import { type ZodRawShape, z } from "zod";

import { isExcludedOperation } from "./excludedOperations.js";
import { type JsonSchema, schemaToZod } from "./schemaToZod.js";
import { type GeneratedTool, HTTP_METHODS, type OperationMetadata } from "./types.js";

function toolNameFor(method: string, pathTemplate: string, operationId?: string): string {
    const id = operationId || `${method}_${pathTemplate.replace(/[{}/]/g, "_")}`;
    return id
        .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
        .replace(/[^a-zA-Z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase();
}

/**
 * OpenAPI lets a parameter be declared once on the path item and shared by every operation
 * under it.
 */
function mergeParameters(
    pathLevel: OpenAPIV3.ParameterObject[],
    operationLevel: OpenAPIV3.ParameterObject[]
): OpenAPIV3.ParameterObject[] {
    const merged = new Map<string, OpenAPIV3.ParameterObject>();
    for (const parameter of [...pathLevel, ...operationLevel]) {
        merged.set(`${parameter.in}:${parameter.name}`, parameter);
    }
    return [...merged.values()];
}

/**
 * A placeholder with no matching path parameter would ship a tool whose request URL still
 * contains the literal `{name}`, so callers get a 404 instead of a result.
 */
function findUndeclaredPlaceholders(pathTemplate: string, pathParams: string[]): string[] {
    const placeholders = [...pathTemplate.matchAll(/{([^}]+)}/g)].map(([, name]) => name);
    return placeholders.filter((name) => !pathParams.includes(name));
}

function findJsonContent(
    content: Record<string, OpenAPIV3.MediaTypeObject> | undefined
): [string, OpenAPIV3.MediaTypeObject] | undefined {
    return Object.entries(content ?? {}).find(([contentType]) => /^application\/([\w.-]+\+)?json$/.test(contentType));
}

/**
 * The generic generated-tool path (callOperation.ts) sends `Accept: application/json` and
 * reads a single response body, so an operation whose success response is only ever a
 * text/event-stream (SSE) can't work over it — makeDoitRequest gets a 406/unparseable body,
 * returns null, and the tool reports an opaque "Failed to call ...". Such endpoints must be
 * hand-written to consume the stream (see handleBuildCloudflowRequest in src/tools/cloudflow.ts)
 * or excluded (excludedOperations.json). Skip here — like the undeclared-placeholder guard —
 * so a future SSE endpoint can't silently ship a generic tool that can only ever fail.
 */
function isEventStreamOnlyOperation(operation: OpenAPIV3.OperationObject): boolean {
    const success = (operation.responses?.["200"] ?? operation.responses?.["201"]) as
        | OpenAPIV3.ResponseObject
        | undefined;
    const contentTypes = Object.keys(success?.content ?? {});
    return contentTypes.length > 0 && contentTypes.every((type) => type.split(";")[0].trim() === "text/event-stream");
}

/**
 * DELETE operations are irreversible, so they go through the server-side two-phase approval
 * flow (`approval_required` → `confirm_action`) rather than relying on the client honouring
 * `destructiveHint`, which is advisory only. The summary is the text the user confirms.
 */
function buildDeleteSummary(operationSummary: string | undefined, pathTemplate: string, pathParams: string[]) {
    return (args: Record<string, unknown>) => {
        const target = pathParams.map((name) => `${name}=${JSON.stringify(String(args?.[name] ?? ""))}`).join(", ");
        const scope = args?.customerContext ? ` for customer ${String(args.customerContext)}` : "";
        const label = operationSummary ?? `Delete ${pathTemplate}`;
        return `${label}${target ? ` (${target})` : ""}${scope}. This cannot be undone: DELETE ${pathTemplate}.`;
    };
}

/**
 * Builds one MCP tool per OpenAPI operation not already covered by a hand-written tool.
 * `coveredEndpoints` is derived from every hand-written tool's own `coversEndpoint` field
 * (see src/tools/handWrittenTools.ts) — callers pass COVERED_ENDPOINTS from that module.
 */
export function generateTools(document: OpenAPIV3.Document, coveredEndpoints: Set<string>): GeneratedTool[] {
    const tagDescriptions = new Map((document.tags ?? []).map((tag) => [tag.name, tag.description] as const));
    const tools: GeneratedTool[] = [];

    for (const [pathTemplate, pathItem] of Object.entries(document.paths ?? {})) {
        if (!pathItem) continue;

        for (const method of HTTP_METHODS) {
            const operation = pathItem[method];
            if (!operation) continue;
            if (coveredEndpoints.has(`${method}:${pathTemplate}`.toLowerCase())) continue;
            if (isExcludedOperation(method, pathTemplate, operation.tags)) continue;

            if (isEventStreamOnlyOperation(operation)) {
                console.error(
                    `Skipping generated tool for ${method.toUpperCase()} ${pathTemplate}: response is text/event-stream only (SSE); the generic generated-tool path cannot consume a stream. Hand-write a tool that consumes the stream, or add it to excludedOperations.json.`
                );
                continue;
            }

            const parameters = mergeParameters(
                (pathItem.parameters ?? []) as OpenAPIV3.ParameterObject[],
                (operation.parameters ?? []) as OpenAPIV3.ParameterObject[]
            );
            const pathParams = parameters.filter((parameter) => parameter.in === "path");
            const queryParams = parameters.filter((parameter) => parameter.in === "query");
            const headerParams = parameters.filter((parameter) => parameter.in === "header");

            const shape: ZodRawShape = {};
            for (const parameter of [...pathParams, ...queryParams, ...headerParams]) {
                const zodType = schemaToZod(parameter.schema as unknown as JsonSchema);
                shape[parameter.name] = parameter.required ? zodType : zodType.optional();
            }

            const requestBodyContent = (operation.requestBody as OpenAPIV3.RequestBodyObject | undefined)?.content;
            const [jsonContentType, jsonMediaType] = findJsonContent(requestBodyContent) ?? [];
            const jsonBodySchema = jsonMediaType?.schema as unknown as JsonSchema | undefined;
            const multipartBodySchema = requestBodyContent?.["multipart/form-data"]?.schema as unknown as
                | JsonSchema
                | undefined;

            const bodyEncoding: OperationMetadata["bodyEncoding"] = jsonBodySchema ? "json" : "multipart";
            const requestBodySchema = jsonBodySchema ?? multipartBodySchema;
            const multipartFileFields: string[] = [];

            if (requestBodySchema?.properties) {
                for (const [key, propSchema] of Object.entries(requestBodySchema.properties)) {
                    const zodType = schemaToZod(propSchema);
                    shape[key] = requestBodySchema.required?.includes(key) ? zodType : zodType.optional();
                    if (bodyEncoding === "multipart" && propSchema.format === "binary") {
                        multipartFileFields.push(key);
                    }
                }
            }

            const metadata: OperationMetadata = {
                method,
                pathTemplate,
                pathParams: pathParams.map((parameter) => parameter.name),
                queryParams: [...queryParams.map((parameter) => parameter.name), "customerContext"],
                headerParams: headerParams.map((parameter) => parameter.name),
                bodyEncoding,
                contentType: jsonContentType,
                multipartFileFields,
            };

            // Dropping just this operation rather than throwing: generateTools runs at module load
            // (see registry.ts), so a single malformed upstream path must not take down the server
            // and every other tool with it. The bundled spec is asserted clean in the tests.
            const undeclared = findUndeclaredPlaceholders(pathTemplate, metadata.pathParams);
            if (undeclared.length > 0) {
                console.error(
                    `Skipping generated tool for ${method.toUpperCase()} ${pathTemplate}: URL placeholders with no declared path parameter: ${undeclared.join(", ")}`
                );
                continue;
            }

            // Every operation supports scoping to a customer, but the OpenAPI spec itself has
            // no notion of this (callOperation.ts reads it as a query param) — declare it here
            // so it's visible to callers instead of only working if you already know about it.
            shape.customerContext = z
                .string()
                .optional()
                .describe(
                    "Scope the request to a specific customer by ID. Required for DoiT employees (whose token isn't tied to a single customer); omit for direct customer users."
                );

            const name = toolNameFor(method, pathTemplate, operation.operationId);

            const baseDescription =
                operation.description ?? operation.summary ?? `${method.toUpperCase()} ${pathTemplate}`;
            const tagDescription = tagDescriptions.get(operation.tags?.[0] ?? "");
            const isPaginated = queryParams.some((parameter) => parameter.name === "pageToken");
            const paginationNote = isPaginated
                ? " This endpoint is paginated: to fetch the next page, call again passing the response's `pageToken` value as the `pageToken` parameter. Stop once the response has no `pageToken` — that means there are no more pages."
                : "";
            const description = `${tagDescription ? `${tagDescription} ` : ""}${baseDescription}${paginationNote}`;

            const isReadOnly = method === "get";

            tools.push({
                name,
                description,
                zodSchema: z.object(shape),
                metadata,
                annotations: {
                    readOnlyHint: isReadOnly,
                    destructiveHint: !isReadOnly,
                    openWorldHint: true,
                },
                securitySchemes: [
                    {
                        type: "oauth2",
                        scopes: isReadOnly ? ["read_data"] : ["read_data", "write_data"],
                    },
                ],
                ...(method === "delete"
                    ? { summary: buildDeleteSummary(operation.summary, pathTemplate, metadata.pathParams) }
                    : {}),
            });
        }
    }

    return tools;
}
