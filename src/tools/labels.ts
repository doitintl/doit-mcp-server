import { z } from "zod";
import type { Label, LabelsResponse } from "../types/labels.js";
import { LABEL_COLOR_VALUES, LABEL_SORT_BY_VALUES, LABEL_SORT_ORDER_VALUES } from "../types/labels.js";
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

export const LABELS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/labels`;

export const DEFAULT_MAX_RESULTS_LABELS = DEFAULT_MAX_RESULTS;

export const ListLabelsArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(
            `The maximum number of results to return in a single page. Defaults to ${DEFAULT_MAX_RESULTS_LABELS}.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Page token, returned by a previous call, to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe("An expression for filtering the results. Valid fields: name, type. Example: name:budget"),
    sortBy: z
        .enum(LABEL_SORT_BY_VALUES)
        .optional()
        .describe(
            `A field by which the results will be sorted. Accepted values: ${formatEnumValues(LABEL_SORT_BY_VALUES)}.`
        ),
    sortOrder: z
        .enum(LABEL_SORT_ORDER_VALUES)
        .optional()
        .describe(`The sort order for results. Accepted values: ${formatEnumValues(LABEL_SORT_ORDER_VALUES)}.`),
});

export const listLabelsTool = {
    name: "list_labels",
    description:
        "Returns a list of labels from the DoiT API that the user has access to. Labels are listed in reverse chronological order by default.",
    inputSchema: zodToMcpInputSchema(ListLabelsArgumentsSchema),
};

export async function handleListLabelsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken, filter, sortBy, sortOrder } = ListLabelsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_LABELS);
        if (pageToken) params.append("pageToken", pageToken);
        if (filter) params.append("filter", filter);
        if (sortBy) params.append("sortBy", sortBy);
        if (sortOrder) params.append("sortOrder", sortOrder);

        const url = `${LABELS_BASE_URL}?${params}`;

        const data = await makeDoitRequest<LabelsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve labels");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list labels request");
    }
}

// Schema and metadata for get label
export const GetLabelArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Label ID is required and cannot be empty."))
        .describe("The ID of the label to retrieve."),
});

export const getLabelTool = {
    name: "get_label",
    description: "Returns details of a specific label from the DoiT API by its ID.",
    inputSchema: zodToMcpInputSchema(GetLabelArgumentsSchema),
};

export async function handleGetLabelRequest(args: any, token: string) {
    try {
        const { id } = GetLabelArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${LABELS_BASE_URL}/${encodeURIComponent(id)}`;
        const data = await makeDoitRequest<Label>(url, token, { method: "GET", customerContext });
        if (!data) {
            return createErrorResponse("Failed to retrieve label");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get label request");
    }
}

// Schema and metadata for create label
export const CreateLabelArgumentsSchema = z.object({
    name: z.string().min(1).describe("The name of the label (required, non-empty)."),
    color: z
        .enum(LABEL_COLOR_VALUES)
        .describe(`The color of the label (required). Accepted values: ${formatEnumValues(LABEL_COLOR_VALUES)}.`),
});

export const createLabelTool = {
    name: "create_label",
    description: "Creates a new label in the DoiT platform. Labels can be applied to reports and other resources.",
    inputSchema: zodToMcpInputSchema(CreateLabelArgumentsSchema),
};

export async function handleCreateLabelRequest(args: any, token: string) {
    try {
        const parsed = CreateLabelArgumentsSchema.parse(args);
        const { customerContext } = args;
        const body = { ...parsed };

        const data = await makeDoitRequest<Label>(LABELS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to create label");
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create label request");
    }
}

// Schema and metadata for update label
const UpdateLabelBaseSchema = CreateLabelArgumentsSchema.partial();

export const UpdateLabelArgumentsSchema = UpdateLabelBaseSchema.extend({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Label ID is required and cannot be empty."))
        .describe("The ID of the label to update (required)."),
    name: UpdateLabelBaseSchema.shape.name
        .nullable()
        .describe("The name of the label. Must be non-empty if provided, or null to clear."),
    color: UpdateLabelBaseSchema.shape.color
        .nullable()
        .describe(
            `The color of the label. Accepted values: ${formatEnumValues(LABEL_COLOR_VALUES)}, or null to clear.`
        ),
});

export const updateLabelTool = {
    name: "update_label",
    description:
        "Updates an existing label in the DoiT platform. Supports partial updates — only the fields provided will be changed.",
    inputSchema: zodToMcpInputSchema(UpdateLabelArgumentsSchema),
};

export async function handleUpdateLabelRequest(args: any, token: string) {
    try {
        const parsed = UpdateLabelArgumentsSchema.parse(args);
        const { customerContext } = args;
        const { id, ...body } = parsed;
        const url = `${LABELS_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest<Label>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to update label");
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update label request");
    }
}
