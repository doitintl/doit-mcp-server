import { z } from "zod";
import type { AssetDetailed, ListAssetsResponse } from "../types/assets.js";
import { DEFAULT_MAX_RESULTS } from "../utils/consts.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const ASSETS_BASE_URL = `${DOIT_API_BASE}/billing/v1/assets`;

// Schema definitions
export const ListAssetsArgumentsSchema = z.object({
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
            'An expression for filtering the results. Uses key:[value] syntax, e.g. "type:g-suite". Multiple filters can be connected using a pipe |. Different keys result in AND; same key multiple times results in OR.'
        ),
});

export const listAssetsTool = {
    name: "list_assets",
    description:
        "Returns a list of all available customer assets such as Google Cloud billing accounts, G Suite/Workspace subscriptions, etc. Assets are returned in reverse chronological order by default.",
    inputSchema: zodToMcpInputSchema(ListAssetsArgumentsSchema),
};

export async function handleListAssetsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken, filter } = ListAssetsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS);
        if (pageToken) params.append("pageToken", pageToken);
        if (filter) params.append("filter", filter);

        const url = `${ASSETS_BASE_URL}?${params}`;

        const data = await makeDoitRequest<ListAssetsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve assets");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list assets request");
    }
}

// Schema and metadata for get asset
export const GetAssetArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Asset ID is required and cannot be empty."))
        .describe("The ID of the asset to retrieve."),
});

export const getAssetTool = {
    name: "get_asset",
    description:
        "Returns details of a specific customer asset from the DoiT API by its ID, including properties such as customer domain, customer ID, reseller, and subscription details.",
    inputSchema: zodToMcpInputSchema(GetAssetArgumentsSchema),
};

export async function handleGetAssetRequest(args: any, token: string) {
    try {
        const { id } = GetAssetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${ASSETS_BASE_URL}/${encodeURIComponent(id)}`;
        const data = await makeDoitRequest<AssetDetailed>(url, token, { method: "GET", customerContext });
        if (!data) {
            return createErrorResponse("Failed to retrieve asset");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get asset request");
    }
}
