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
        "Returns a list of all the available products of specific platforms from DoiT API. If no platform is specified, it returns products from all platforms.",
    inputSchema: zodToMcpInputSchema(ListProductsArgumentsSchema),
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
