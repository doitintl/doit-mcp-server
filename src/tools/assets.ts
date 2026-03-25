import { z } from "zod";
import type { AssetDetailed, CreateAssetResponse, ListAssetsResponse, UpdateAssetResponse } from "../types/assets.js";
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
export const CREATE_ASSET_URL = `${DOIT_API_BASE}/billing/v1/createAsset`;
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

// Schema and metadata for create asset
export const CreateAssetArgumentsSchema = z.object({
    type: z
        .string()
        .min(1, "Asset type must be non-empty if provided.")
        .optional()
        .default("amazon-web-services")
        .describe('Asset type. For example, "amazon-web-services" (default).'),
    mode: z
        .string()
        .min(1, "Asset mode must be non-empty if provided.")
        .optional()
        .default("New")
        .describe('Asset mode (default: "New").'),
    accountName: z
        .string()
        .min(1, "Account name must be non-empty if provided.")
        .optional()
        .default("Account name")
        .describe('The desired name of the account (default: "Account name").'),
    rootEmail: z.string().email("Must be a valid email address.").optional().describe("The root account email."),
});

export const createAssetTool = {
    name: "create_asset",
    description: "Creates a new customer asset (e.g., an AWS account) via the DoiT API. Returns the new account ID.",
    inputSchema: zodToMcpInputSchema(CreateAssetArgumentsSchema),
};

export async function handleCreateAssetRequest(args: any, token: string) {
    try {
        const parsed = CreateAssetArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("type", parsed.type);
        params.append("mode", parsed.mode);
        params.append("accountName", parsed.accountName);
        if (parsed.rootEmail) params.append("rootEmail", parsed.rootEmail);

        const url = `${CREATE_ASSET_URL}?${params}`;

        const data = await makeDoitRequest<CreateAssetResponse>(url, token, {
            method: "POST",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create asset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create asset request");
    }
}

// Schema and metadata for update asset
export const UpdateAssetArgumentsSchema = z.object({
    id: z
        .string()
        .transform((val) => val.trim())
        .pipe(z.string().min(1, "Asset ID is required and cannot be empty."))
        .describe("The ID of the asset to update."),
    quantity: z
        .number()
        .int()
        .positive("Quantity must be a positive integer.")
        .describe("The new license quantity for the asset (required)."),
});

export const updateAssetTool = {
    name: "update_asset",
    description:
        "Updates an existing customer asset (such as G Suite/Workspace or Office 365 subscription) to add or remove licenses.",
    inputSchema: zodToMcpInputSchema(UpdateAssetArgumentsSchema),
};

export async function handleUpdateAssetRequest(args: any, token: string) {
    try {
        const parsed = UpdateAssetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const { id, ...body } = parsed;
        const url = `${ASSETS_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest<UpdateAssetResponse>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update asset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update asset request");
    }
}
