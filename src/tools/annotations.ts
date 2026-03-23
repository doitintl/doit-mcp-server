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
        "Returns a list of annotations from the DoiT API that the user has access to. Annotations are listed in reverse chronological order by default.",
    inputSchema: zodToMcpInputSchema(ListAnnotationsArgumentsSchema),
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
    description: "Returns details of a specific annotation from the DoiT API by its ID.",
    inputSchema: zodToMcpInputSchema(GetAnnotationArgumentsSchema),
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
