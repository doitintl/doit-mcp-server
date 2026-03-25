import { z } from "zod";
import type { Label, LabelAssignmentsResponse, LabelsResponse } from "../types/labels.js";
import {
    LABEL_ASSIGNMENT_OBJECT_TYPE_VALUES,
    LABEL_COLOR_VALUES,
    LABEL_SORT_BY_VALUES,
    LABEL_SORT_ORDER_VALUES,
} from "../types/labels.js";
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
}).refine((data) => data.name !== undefined || data.color !== undefined, {
    message: "At least one of 'name' or 'color' must be provided for an update.",
});

export const updateLabelTool = {
    name: "update_label",
    description:
        "Updates an existing label in the DoiT platform. Supports partial updates — at least one of 'name' or 'color' must be provided.",
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

// Schema and metadata for get label assignments
export const GetLabelAssignmentsArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Label ID is required and cannot be empty."))
        .describe("The ID of the label to retrieve assignments for."),
});

export const getLabelAssignmentsTool = {
    name: "get_label_assignments",
    description:
        "Returns the list of objects (alerts, allocations, budgets, metrics, reports, annotations) currently assigned to a specific label.",
    inputSchema: zodToMcpInputSchema(GetLabelAssignmentsArgumentsSchema),
};

export async function handleGetLabelAssignmentsRequest(args: any, token: string) {
    try {
        const { id } = GetLabelAssignmentsArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${LABELS_BASE_URL}/${encodeURIComponent(id)}/assignments`;

        const data = await makeDoitRequest<LabelAssignmentsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to retrieve label assignments");
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get label assignments request");
    }
}

// Schema and metadata for assign objects to label
const LabelAssignmentObjectSchema = z.object({
    objectId: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "objectId is required and cannot be empty."))
        .describe("The ID of the object."),
    objectType: z
        .enum(LABEL_ASSIGNMENT_OBJECT_TYPE_VALUES)
        .describe(`The type of the object. Accepted values: ${formatEnumValues(LABEL_ASSIGNMENT_OBJECT_TYPE_VALUES)}.`),
});

export const AssignObjectsToLabelArgumentsSchema = z
    .object({
        id: z
            .string()
            .transform((val) => val.trim())
            .pipe(z.string().min(1, "Label ID is required and cannot be empty."))
            .describe("The ID of the label to assign or unassign objects to."),
        add: z
            .array(LabelAssignmentObjectSchema)
            .optional()
            .describe("Array of objects to assign to the label. Each object must have objectId and objectType."),
        remove: z
            .array(LabelAssignmentObjectSchema)
            .optional()
            .describe("Array of objects to unassign from the label. Each object must have objectId and objectType."),
    })
    .refine((data) => (data.add && data.add.length > 0) || (data.remove && data.remove.length > 0), {
        message: "At least one of 'add' or 'remove' must be provided with at least one object.",
    });

export const assignObjectsToLabelTool = {
    name: "assign_objects_to_label",
    description:
        "Assigns or unassigns objects (alerts, allocations, budgets, metrics, reports, annotations) to a label. At least one of 'add' or 'remove' must be provided.",
    inputSchema: zodToMcpInputSchema(AssignObjectsToLabelArgumentsSchema),
};

export async function handleAssignObjectsToLabelRequest(args: any, token: string) {
    try {
        const { id, add, remove } = AssignObjectsToLabelArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${LABELS_BASE_URL}/${encodeURIComponent(id)}/assignments`;

        const body: Record<string, unknown> = {};
        if (add) body.add = add;
        if (remove) body.remove = remove;

        const data = await makeDoitRequest<Record<string, unknown>>(url, token, {
            method: "POST",
            body,
            customerContext,
            parseResponse: false,
        });

        if (!data) return createErrorResponse("Failed to assign objects to label");
        return createSuccessResponse("Successfully updated label assignments.");
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling assign objects to label request");
    }
}
