import { z } from "zod";
import type { AssetDetailed, ListAssetsResponse } from "../types/assets.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
    matchByName,
} from "../utils/util.js";

export const ASSETS_BASE_URL = `${DOIT_API_BASE}/billing/v1/assets`;
export const DEFAULT_MAX_RESULTS_ASSETS = "100";
export const MAX_MAX_RESULTS_ASSETS = 249;

// Schema definitions
export const ListAssetsArgumentsSchema = z.object({
    maxResults: z
        .string()
        .trim()
        .optional()
        .refine(
            (value) =>
                value === undefined ||
                (/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= MAX_MAX_RESULTS_ASSETS),
            {
                message: `Must be a positive integer no greater than ${MAX_MAX_RESULTS_ASSETS}.`,
            }
        )
        .describe(
            `The maximum number of results to return in a single page. Defaults to ${DEFAULT_MAX_RESULTS_ASSETS}. Maximum allowed value is ${MAX_MAX_RESULTS_ASSETS}.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Page token, returned by a previous call, to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe(
            'Server-side filter with type as the only supported key. Exact, case-sensitive values without brackets, e.g. "type:g-suite". Repeating type with pipe | matches any listed type (OR), e.g. "type:g-suite|type:office-365".'
        ),
    name: z
        .string()
        .optional()
        .describe(
            "Case-insensitive substring filter on the returned API page only. Other pages are not searched. pageToken and rowCount retain the API's unfiltered page values, even when no assets match."
        ),
});

export const listAssetsTool = {
    name: "list_assets",
    title: "List assets",
    coversEndpoint: "get:/billing/v1/assets",
    description:
        "Use this when the user wants to browse their cloud assets, subscriptions, or resources. Returns a paginated list of assets. Name filtering is case-insensitive and applies only to the returned page. The API cursor and unfiltered rowCount are preserved, including on pages with no matches. Do NOT use this for cost analysis (use run_query) or checking invoices (use list_invoices).",
    inputSchema: zodToMcpInputSchema(ListAssetsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading cloud assets...",
        "openai/toolInvocation/invoked": "Assets loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListAssetsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken, filter, name } = ListAssetsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_ASSETS);
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

        if (name) {
            const q = name.toLowerCase();
            (data as any).assets = ((data as any).assets ?? []).filter(
                (a: any) => typeof a.name === "string" && a.name.toLowerCase().includes(q)
            );
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list assets request");
    }
}

// Schema and metadata for get asset
export const GetAssetArgumentsSchema = z
    .object({
        id: z
            .string()
            .transform((val) => val.trim())
            .pipe(z.string().min(1))
            .optional()
            .describe("The ID of the asset to retrieve. Takes precedence when both id and name are provided."),
        name: z
            .string()
            .optional()
            .describe(
                "Case-insensitive substring lookup within the first 249 assets only. Multiple matches return an ambiguity error; id takes precedence."
            ),
    })
    .refine((d) => d.id || d.name, { message: "Either id or name must be provided." });

export const getAssetTool = {
    name: "get_asset",
    title: "Get asset",
    coversEndpoint: "get:/billing/v1/assets/{id}",
    description:
        "Use this when the user wants to view details of a specific cloud asset. Accepts an asset ID, which takes precedence over name, or a case-insensitive partial name lookup within the first 249 assets only. Multiple name matches return an ambiguity error. Do NOT use this for listing all assets (use list_assets) or cost analysis (use run_query).",
    inputSchema: zodToMcpInputSchema(GetAssetArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading asset details...",
        "openai/toolInvocation/invoked": "Asset details loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetAssetRequest(args: any, token: string) {
    try {
        const parsed = GetAssetArgumentsSchema.parse(args);
        const { customerContext } = args;
        let resolvedId = parsed.id;

        if (!resolvedId && parsed.name) {
            const listData = await makeDoitRequest<ListAssetsResponse>(`${ASSETS_BASE_URL}?maxResults=249`, token, {
                method: "GET",
                customerContext,
            });
            const items = ((listData as any)?.assets ?? []) as Array<{ id: string; name: string }>;
            const result = matchByName(items, parsed.name);
            if ("error" in result) return createErrorResponse(result.error);
            // (multiple match case now handled as error by matchByName)
            resolvedId = result.resolved;
        }

        const url = `${ASSETS_BASE_URL}/${encodeURIComponent(resolvedId as string)}`;
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
