import { z } from "zod";
import type { BudgetsResponse } from "../types/budgets.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const BUDGETS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/budgets`;

export const DEFAULT_MAX_RESULTS_BUDGETS = "50";

export const ListBudgetsArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(
            `The maximum number of results to return in a single page. Defaults to ${DEFAULT_MAX_RESULTS_BUDGETS}.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Page token, returned by a previous call, to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe(
            'An expression for filtering the results. Syntax: "key:[<value>]". Available keys: owner, lastModified in ms (>lastModified). Multiple filters can be connected using a pipe |. Note that using different keys in the same filter results in "AND," while using the same key multiple times in the same filter results in "OR".'
        ),
    minCreationTime: z
        .string()
        .optional()
        .describe(
            "Min value for budget creation time, in milliseconds since the POSIX epoch. Only budgets created after or at this timestamp are returned."
        ),
    maxCreationTime: z
        .string()
        .optional()
        .describe(
            "Max value for budget creation time, in milliseconds since the POSIX epoch. Only budgets created before or at this timestamp are returned."
        ),
});

export const listBudgetsTool = {
    name: "list_budgets",
    description:
        "Returns the list of budgets from the DoiT API that the user has access to. Supports pagination and filtering by owner, last modified time, and creation time range.",
    inputSchema: zodToMcpInputSchema(ListBudgetsArgumentsSchema),
};

export async function handleListBudgetsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken, filter, minCreationTime, maxCreationTime } =
            ListBudgetsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_BUDGETS);
        if (pageToken) params.append("pageToken", pageToken);
        if (filter) params.append("filter", filter);
        if (minCreationTime) params.append("minCreationTime", minCreationTime);
        if (maxCreationTime) params.append("maxCreationTime", maxCreationTime);

        const url = `${BUDGETS_BASE_URL}?${params}`;

        const data = await makeDoitRequest<BudgetsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve budgets");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list budgets request");
    }
}
