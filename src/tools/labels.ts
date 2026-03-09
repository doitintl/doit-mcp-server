import { z } from "zod";
import type { LabelsResponse } from "../types/labels.js";
import { LABEL_SORT_BY_VALUES, LABEL_SORT_ORDER_VALUES } from "../types/labels.js";
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
        .describe("The maximum number of results to return in a single page. Defaults to 500."),
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
