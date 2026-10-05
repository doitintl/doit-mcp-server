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
            `The maximum number of results per page, from 1 to 500. Defaults to ${DEFAULT_MAX_RESULTS_COMMITMENTS}. The API falls back to 50 for out-of-range integers and rejects non-integers.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Page token, returned by a previous call, to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe(
            "Exact, case-sensitive filtering using key:value without brackets. Supported keys: name, provider, cloudProvider (alias of provider). Provider values: google-cloud, amazon-web-services, microsoft-azure. Different keys combine with pipe | (AND); repeated keys, including provider with cloudProvider, are rejected. Example: provider:google-cloud"
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
    title: "List commitments",
    coversEndpoint: "get:/analytics/v1/commitment-manager",
    description:
        "Returns a paginated list of spend commitment contracts from the DoiT Commitment Manager for Google Cloud, AWS, and Azure. These are negotiated spend commitments, rather than resource usage commitments; AWS agreements may be called Enterprise Discount Programs (EDP).",
    inputSchema: zodToMcpInputSchema(ListCommitmentsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
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
    title: "Get commitment",
    coversEndpoint: "get:/analytics/v1/commitment-manager/{id}",
    description:
        "Returns details of a specific spend commitment contract for Google Cloud, AWS, or Azure, identified by its ID. Includes the full breakdown of commitment periods, per-period contracted values, and current spend attainment against the committed amount.",
    inputSchema: zodToMcpInputSchema(GetCommitmentArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
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
