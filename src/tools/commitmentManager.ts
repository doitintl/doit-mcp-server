import { z } from "zod";
import { COMMITMENT_SORT_BY_VALUES, COMMITMENT_SORT_ORDER_VALUES } from "../types/commitmentManager.js";
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

export const COMMITMENT_MANAGER_BASE_URL = `${DOIT_API_BASE}/analytics/v1/commitment-manager`;

export const DEFAULT_MAX_RESULTS_COMMITMENTS = "50";

export const ListCommitmentsArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(
            `The maximum number of results to return in a single page. Defaults to ${DEFAULT_MAX_RESULTS_COMMITMENTS}.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Page token, returned by a previous call, to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe(
            "An expression for filtering the results. Syntax: key:[<value>]. Multiple filters can be connected using pipe |. Available filter keys: name, provider. Example: provider:[google-cloud]"
        ),
    sortBy: z
        .enum(COMMITMENT_SORT_BY_VALUES)
        .optional()
        .describe(
            `A field by which the results will be sorted. Accepted values: ${formatEnumValues(COMMITMENT_SORT_BY_VALUES)}.`
        ),
    sortOrder: z
        .enum(COMMITMENT_SORT_ORDER_VALUES)
        .optional()
        .describe(`The sort order for results. Accepted values: ${formatEnumValues(COMMITMENT_SORT_ORDER_VALUES)}.`),
});

export const listCommitmentsTool = {
    name: "list_commitments",
    description:
        "Returns a list of commitments from the DoiT API that the user has access to. Commitments represent reserved capacity or spend agreements with cloud providers.",
    inputSchema: zodToMcpInputSchema(ListCommitmentsArgumentsSchema),
};

export async function handleListCommitmentsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken, filter, sortBy, sortOrder } = ListCommitmentsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_COMMITMENTS);
        if (pageToken) params.append("pageToken", pageToken);
        if (filter) params.append("filter", filter);
        if (sortBy) params.append("sortBy", sortBy);
        if (sortOrder) params.append("sortOrder", sortOrder);

        const url = `${COMMITMENT_MANAGER_BASE_URL}?${params}`;

        const data = await makeDoitRequest(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve commitments");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list commitments request");
    }
}

export const GetCommitmentArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Commitment ID is required and cannot be empty."))
        .describe("The ID of the commitment to retrieve."),
});

export const getCommitmentTool = {
    name: "get_commitment",
    description:
        "Returns details of a specific commitment from the DoiT API by its ID, including periods and attainment data.",
    inputSchema: zodToMcpInputSchema(GetCommitmentArgumentsSchema),
};

export async function handleGetCommitmentRequest(args: any, token: string) {
    try {
        const { id } = GetCommitmentArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${COMMITMENT_MANAGER_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest(url, token, { method: "GET", customerContext });

        if (!data) {
            return createErrorResponse("Failed to retrieve commitment");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get commitment request");
    }
}
