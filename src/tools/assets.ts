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
            'An expression for filtering the results. Uses key:[value] syntax, e.g. "type:g-suite". Multiple filters can be connected using a pipe |. Different keys result in AND; same key multiple times results in OR.'
        ),
    name: z
        .string()
        .optional()
        .describe("Partial name filter (case-insensitive). Returns only assets whose name contains this string."),
});

export const listAssetsTool = {
    name: "list_assets",
    description:
        "Use this when the user wants to browse their cloud assets, subscriptions, or resources. Returns a paginated list of assets. Supports partial name filtering. Do NOT use this for cost analysis (use run_query) or checking invoices (use list_invoices).",
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
            .describe("The ID of the asset to retrieve."),
        name: z
            .string()
            .optional()
            .describe("Partial name match (case-insensitive). Used to find the asset when ID is unknown."),
    })
    .refine((d) => d.id || d.name, { message: "Either id or name must be provided." });

export const getAssetTool = {
    name: "get_asset",
    description:
        "Use this when the user wants to view details of a specific cloud asset. Accepts either the asset ID or a partial name (case-insensitive). Do NOT use this for listing all assets (use list_assets) or cost analysis (use run_query).",
    inputSchema: {
        type: "object",
        properties: {
            id: { type: "string", description: "The ID of the asset to retrieve." },
            name: {
                type: "string",
                description: "Partial name match (case-insensitive). Used to find the asset when ID is unknown.",
            },
        },
    },
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
