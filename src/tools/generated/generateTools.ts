import type { OpenAPIV3 } from "openapi-types";
import { type ZodRawShape, z } from "zod";

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

            const parameters = (operation.parameters ?? []) as OpenAPIV3.ParameterObject[];
            const pathParams = parameters.filter((parameter) => parameter.in === "path");
            const queryParams = parameters.filter((parameter) => parameter.in === "query");
            const headerParams = parameters.filter((parameter) => parameter.in === "header");

            const shape: ZodRawShape = {};
            for (const parameter of [...pathParams, ...queryParams, ...headerParams]) {
                const zodType = schemaToZod(parameter.schema as unknown as JsonSchema);
                shape[parameter.name] = parameter.required ? zodType : zodType.optional();
            }

            const requestBodyContent = (operation.requestBody as OpenAPIV3.RequestBodyObject | undefined)?.content;
            const jsonBodySchema = requestBodyContent?.["application/json"]?.schema as unknown as
                | JsonSchema
                | undefined;
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
                multipartFileFields,
            };

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
            });
        }
    }

    return tools;
}
