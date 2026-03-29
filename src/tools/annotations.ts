import { z } from "zod";
import type { Annotation, AnnotationsResponse } from "../types/annotations.js";
import { ANNOTATION_SORT_BY_VALUES, ANNOTATION_SORT_ORDER_VALUES } from "../types/annotations.js";
import { DEFAULT_MAX_RESULTS } from "../utils/consts.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatEnumValues,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const ANNOTATIONS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/annotations`;

export const DEFAULT_MAX_RESULTS_ANNOTATIONS = DEFAULT_MAX_RESULTS;

export const ListAnnotationsArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(`The maximum number of results to return in a single page. Defaults to ${DEFAULT_MAX_RESULTS}.`),
    pageToken: z
        .string()
        .optional()
        .describe("Page token, returned by a previous call, to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe(
            "An expression for filtering the results. Valid fields: content, timestamp, labels. Example: content:budget"
        ),
    sortBy: z
        .enum(ANNOTATION_SORT_BY_VALUES)
        .optional()
        .describe(
            `A field by which the results will be sorted. Accepted values: ${formatEnumValues(ANNOTATION_SORT_BY_VALUES)}.`
        ),
    sortOrder: z
        .enum(ANNOTATION_SORT_ORDER_VALUES)
        .optional()
        .describe(`The sort order for results. Accepted values: ${formatEnumValues(ANNOTATION_SORT_ORDER_VALUES)}.`),
});

export const listAnnotationsTool = {
    name: "list_annotations",
    description:
        "Use this when the user wants to see calendar annotations or notes on cost data. Returns a list of annotations. Do NOT use this for labels (use list_labels) or alerts (use list_alerts).",
    inputSchema: zodToMcpInputSchema(ListAnnotationsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading annotations...",
        "openai/toolInvocation/invoked": "Annotations loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListAnnotationsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken, filter, sortBy, sortOrder } = ListAnnotationsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_ANNOTATIONS);
        if (pageToken) params.append("pageToken", pageToken);
        if (filter) params.append("filter", filter);
        if (sortBy) params.append("sortBy", sortBy);
        if (sortOrder) params.append("sortOrder", sortOrder);

        const url = `${ANNOTATIONS_BASE_URL}?${params}`;

        const data = await makeDoitRequest<AnnotationsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve annotations");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list annotations request");
    }
}

// Schema and metadata for get annotation
export const GetAnnotationArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Annotation ID is required and cannot be empty."))
        .describe("The ID of the annotation to retrieve."),
});

export const getAnnotationTool = {
    name: "get_annotation",
    description:
        "Use this when the user wants to view details of a specific annotation by its ID. Do NOT use this for listing all annotations (use list_annotations) or labels (use list_labels).",
    inputSchema: zodToMcpInputSchema(GetAnnotationArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading annotation...",
        "openai/toolInvocation/invoked": "Annotation loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetAnnotationRequest(args: any, token: string) {
    try {
        const { id } = GetAnnotationArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${ANNOTATIONS_BASE_URL}/${encodeURIComponent(id)}`;
        const data = await makeDoitRequest<Annotation>(url, token, { method: "GET", customerContext });
        if (!data) {
            return createErrorResponse("Failed to retrieve annotation");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get annotation request");
    }
}

// Schema and metadata for create annotation
export const CreateAnnotationArgumentsSchema = z.object({
    content: z.string().min(1).describe("The content of the annotation (required, non-empty)."),
    timestamp: z
        .string()
        .min(1, "Timestamp is required and cannot be empty.")
        .datetime({ message: "Timestamp must be a valid ISO 8601 date-time string (e.g. 2026-01-15T00:00:00.000Z)." })
        .describe("The date associated with the annotation in ISO 8601 date-time format (required)."),
    reports: z.array(z.string()).optional().describe("List of report IDs to associate with the annotation."),
    labels: z
        .array(z.string())
        .optional()
        .describe("List of label IDs to associate with the annotation. Labels must already exist."),
});

export const createAnnotationTool = {
    name: "create_annotation",
    description:
        "Use this when the user wants to add a new annotation to mark a specific date or event in cost data. Ask the user to confirm the annotation details before executing. Do NOT use this for creating labels (use create_label) or alerts (use create_alert).",
    inputSchema: zodToMcpInputSchema(CreateAnnotationArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Creating annotation...",
        "openai/toolInvocation/invoked": "Annotation created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleCreateAnnotationRequest(args: any, token: string) {
    try {
        const parsed = CreateAnnotationArgumentsSchema.parse(args);
        const { customerContext } = args;
        const body = { ...parsed };

        const data = await makeDoitRequest<Annotation>(ANNOTATIONS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create annotation");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create annotation request");
    }
}

// Schema and metadata for update annotation
export const UpdateAnnotationArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Annotation ID is required and cannot be empty."))
        .describe("The ID of the annotation to update (required)."),
    content: z
        .string()
        .min(1)
        .nullable()
        .optional()
        .describe("The content of the annotation. Set to null to clear. Must be non-empty if provided as a string."),
    timestamp: z
        .string()
        .min(1)
        .datetime({
            message: "Timestamp must be a valid ISO 8601 date-time string (e.g. 2026-01-15T00:00:00.000Z).",
        })
        .nullable()
        .optional()
        .describe("The date associated with the annotation in ISO 8601 date-time format. Set to null to clear."),
    reports: z
        .array(z.string())
        .nullable()
        .optional()
        .describe("List of report IDs to associate with the annotation. Set to null to clear."),
    labels: z
        .array(z.string())
        .nullable()
        .optional()
        .describe(
            "List of label IDs to associate with the annotation. Set to null to clear. Labels must already exist."
        ),
});

export const updateAnnotationTool = {
    name: "update_annotation",
    description:
        "Use this when the user wants to modify an existing annotation. Ask the user to confirm changes before executing. Do NOT use this for creating new annotations (use create_annotation) or labels (use update_label).",
    inputSchema: zodToMcpInputSchema(UpdateAnnotationArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Updating annotation...",
        "openai/toolInvocation/invoked": "Annotation updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleUpdateAnnotationRequest(args: any, token: string) {
    try {
        const parsed = UpdateAnnotationArgumentsSchema.parse(args);
        const { customerContext } = args;
        const { id, ...body } = parsed;
        const url = `${ANNOTATIONS_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest<Annotation>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update annotation");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update annotation request");
    }
}
