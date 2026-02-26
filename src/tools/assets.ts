import { z } from "zod";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

// Schema definitions
export const ListAssetsArgumentsSchema = z.object({
    pageToken: z.string().optional().describe("Token for pagination. Use this to get the next page of results."),
});

// Interfaces
export interface Asset {
    createTime: number;
    id: string;
    name: string;
    quantity: number;
    type: string;
    url: string;
}

export interface ListAssetsResponse {
    assets: Asset[];
    pageToken: string;
    rowCount: number;
}

// Tool metadata
export const listAssetsTool = {
    name: "list_assets",
    description:
        "Returns a list of all available customer assets such as Google Cloud billing accounts, G Suite/Workspace subscriptions, etc. Assets are returned in reverse chronological order by default.",
    inputSchema: {
        type: "object",
        properties: {
            pageToken: {
                type: "string",
                description: "Token for pagination. Use this to get the next page of results.",
            },
        },
    },
};

// Format an asset for display
export function formatAsset(asset: Asset): string {
    return [
        `ID: ${asset.id}`,
        `Name: ${asset.name}`,
        `Type: ${asset.type}`,
        `Quantity: ${asset.quantity}`,
        `URL: ${asset.url}`,
        `Created: ${new Date(asset.createTime * 1000).toISOString()}`,
        "-----------",
    ].join("\n");
}

// Handle list assets request
export async function handleListAssetsRequest(args: any, token: string) {
    try {
        // Validate arguments
        const { pageToken } = ListAssetsArgumentsSchema.parse(args);
        const { customerContext } = args;

        // Create API URL with query parameters
        const params = new URLSearchParams();
        if (pageToken) {
            params.append("pageToken", pageToken);
        }

        let assetsUrl = `${DOIT_API_BASE}/billing/v1/assets`;
        if (params.toString()) {
            assetsUrl += `?${params.toString()}`;
        }

        try {
            const assetsData = await makeDoitRequest<ListAssetsResponse>(assetsUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!assetsData) {
                return createErrorResponse("Failed to retrieve assets data");
            }

            const assets = assetsData.assets || [];
            const rowCount = assetsData.rowCount || 0;

            if (assets.length === 0) {
                return createSuccessResponse("No assets found for this customer context.");
            }

            const formattedAssets = assets.map(formatAsset);

            let assetsText = `Found ${rowCount} assets:\n\n`;
            assetsText += formattedAssets.join("\n");

            if (assetsData.pageToken) {
                assetsText += `\n\nPage token: ${assetsData.pageToken}`;
            }

            return createSuccessResponse(assetsText);
        } catch (error) {
            return handleGeneralError(error, "making DoiT API request");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling list assets request");
    }
}
