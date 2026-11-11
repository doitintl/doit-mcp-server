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
    platform: z
        .string({ error: "platform is required: pass a support platform ID from list_platforms." })
        .min(1, "platform is required: pass a support platform ID from list_platforms.")
        .describe(
            "Required. Support platform ID, not a display name. Accepted IDs: google_g_suite, amazon_web_services, microsoft_office_365, finance___billing, google_cloud_platform, microsoft_azure, cloud_management_platform, credits___request, perfectscale. Availability depends on the customer; list_platforms returns the IDs available to the account."
        ),
});

export const listProductsTool = {
    name: "list_products",
    title: "List products",
    coversEndpoint: "get:/support/v1/metadata/products",
    description:
        "Use this when the user wants to see the support-ticket product catalog for one platform. Returns product IDs, display names, and platform IDs. create_ticket uses the product displayName and the platform ID. Requires platform: the full catalog spans several hundred products across all platforms and exceeds the MCP result size limit, so products are listed one platform at a time. Customers do not see private products. This catalog does not list products purchased by the account. Do NOT use this for cloud incidents (use get_cloud_incidents) or platforms (use list_platforms).",
    inputSchema: zodToMcpInputSchema(ListProductsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
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

        const url = `${PRODUCTS_BASE_URL}?${new URLSearchParams({ platform })}`;

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
