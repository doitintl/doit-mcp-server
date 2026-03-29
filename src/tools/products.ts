import { z } from "zod";
import type { ProductsResponse } from "../types/products.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const PRODUCTS_BASE_URL = `${DOIT_API_BASE}/support/v1/metadata/products`;

export const ListProductsArgumentsSchema = z.object({
    platform: z.string().optional().describe("Filter products by platform"),
});

export const listProductsTool = {
    name: "list_products",
    description:
        "Use this when the user wants to see available DoiT products or services. Returns a list of products. Do NOT use this for cloud incidents (use get_cloud_incidents) or platforms (use list_platforms).",
    inputSchema: zodToMcpInputSchema(ListProductsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading products...",
        "openai/toolInvocation/invoked": "Products loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListProductsRequest(args: any, token: string) {
    try {
        const { platform } = ListProductsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        if (platform) params.append("platform", platform);

        const url = params.toString() ? `${PRODUCTS_BASE_URL}?${params}` : PRODUCTS_BASE_URL;

        const data = await makeDoitRequest<ProductsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve products");
        }

        const products = data.products || [];

        if (products.length === 0) {
            return createSuccessResponse("No products found.");
        }

        return createSuccessResponse(JSON.stringify({ products }, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list products request");
    }
}
