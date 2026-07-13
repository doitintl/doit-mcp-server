import { z } from "zod";
import type { SearchCustomersResponse } from "../types/searchCustomers.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    formatZodError,
    handleGeneralError,
    makeConsoleRequest,
} from "../utils/util.js";

// Doer-only console endpoint (console.doit.com). Reached via makeConsoleRequest, NOT
// makeDoitRequest, because it is not on the public api.doit.com surface.
export const SEARCH_CUSTOMERS_PATH = "/api/customers/v1/customers/search";

const ASSET_PLATFORMS = ["amazon-web-services", "google-cloud", "g-suite", "office-365", "microsoft-azure"] as const;

const CLASSIFICATIONS = ["business", "strategic", "terminated", "inactive", "suspendedForNonPayment"] as const;

export const SearchCustomersArgumentsSchema = z.object({
    classification: z
        .array(z.enum(CLASSIFICATIONS))
        .optional()
        .describe("Match customers in any of these classifications (the customer 'kind')."),
    type: z
        .array(z.string())
        .optional()
        .describe(
            "Match any of these customer types, e.g. 'procurement-only', 'product-only', 'procurement-and-product'."
        ),
    segment: z
        .array(z.string())
        .optional()
        .describe("Match any of these customer segments, e.g. 'Invest', 'Incubate', 'Accelerate'."),
    tierPackages: z
        .array(z.string())
        .optional()
        .describe("Match customers subscribed to any of these tier packages, e.g. 'navigator', 'solve'."),
    domains: z
        .array(z.string())
        .optional()
        .describe("Match customers whose primary or secondary domain is any of these."),
    assetPlatforms: z
        .array(z.enum(ASSET_PLATFORMS))
        .optional()
        .describe(
            "Match customers that have at least one asset on any of these cloud platforms (g-suite = Google Workspace, office-365 = Microsoft 365)."
        ),
    hasFlexsave: z
        .boolean()
        .optional()
        .describe("If set, match customers that do (true) or do not (false) have Flexsave enabled on any cloud."),
    standalone: z
        .boolean()
        .optional()
        .describe(
            "If set, match customers that do (true) or do not (false) have at least one standalone (direct self-serve) cloud asset. true keeps standalone/hybrid customers, false keeps resold-only ones."
        ),
    minMonthlyCloudSpend: z
        .number()
        .optional()
        .describe("Minimum denormalized monthly cloud spend (cheap, from the customer record)."),
    maxMonthlyCloudSpend: z.number().optional().describe("Maximum denormalized monthly cloud spend."),
    invoicedFromMonth: z
        .string()
        .optional()
        .describe("Start month (YYYY-MM) for the authoritative invoiced-total spend filter. Requires invoicedToMonth."),
    invoicedToMonth: z
        .string()
        .optional()
        .describe("End month (YYYY-MM) for the invoiced-total spend filter. Requires invoicedFromMonth."),
    invoicedMinTotal: z.number().optional().describe("Minimum summed invoice total over the invoiced month range."),
    invoicedMaxTotal: z.number().optional().describe("Maximum summed invoice total over the invoiced month range."),
    contractsActive: z
        .boolean()
        .optional()
        .describe("If true, match only customers that have at least one active/expired contract."),
    pageSize: z
        .number()
        .int()
        .positive()
        .max(200)
        .optional()
        .describe("Maximum customers to return per page (default 50, max 200)."),
    pageToken: z
        .string()
        .optional()
        .describe("Opaque page token from a previous response's nextPageToken, to fetch the next page."),
});

export const searchCustomersTool = {
    name: "search_customers",
    coversEndpoint: null,
    description:
        "DoiT-internal (doer) tool: search across ALL DoiT customers by what they have — classification/kind, customer type, segment, tier package, domains, cloud asset platforms (AWS, GCP, Google Workspace, Office 365, Azure), Flexsave, standalone (direct self-serve) cloud assets, monthly cloud spend, invoiced spend over a month range, and active contracts. All provided conditions are AND-combined; within a list field the match is any-of. Returns matching customers with a summary and a nextPageToken for paging. Requires DoiT employee access (non-doers get an authorization error). Use this to FIND customers across the base; use other tools to drill into a specific customer.",
    inputSchema: zodToMcpInputSchema(SearchCustomersArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Searching customers...",
        "openai/toolInvocation/invoked": "Customer search complete",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleSearchCustomersRequest(args: any, token: string) {
    try {
        const parsed = SearchCustomersArgumentsSchema.parse(args);

        const filters: Record<string, unknown> = {};

        if (parsed.classification?.length) filters.classification = parsed.classification;
        if (parsed.type?.length) filters.type = parsed.type;
        if (parsed.segment?.length) filters.segment = parsed.segment;
        if (parsed.tierPackages?.length) filters.tierPackages = parsed.tierPackages;
        if (parsed.domains?.length) filters.domains = parsed.domains;
        if (parsed.assetPlatforms?.length) filters.assetPlatforms = parsed.assetPlatforms;
        if (parsed.hasFlexsave !== undefined) filters.hasFlexsave = parsed.hasFlexsave;
        if (parsed.standalone !== undefined) filters.standalone = parsed.standalone;

        const spend: Record<string, unknown> = {};
        if (parsed.minMonthlyCloudSpend !== undefined) spend.minMonthlyCloudSpend = parsed.minMonthlyCloudSpend;
        if (parsed.maxMonthlyCloudSpend !== undefined) spend.maxMonthlyCloudSpend = parsed.maxMonthlyCloudSpend;

        if (
            parsed.invoicedFromMonth !== undefined ||
            parsed.invoicedToMonth !== undefined ||
            parsed.invoicedMinTotal !== undefined ||
            parsed.invoicedMaxTotal !== undefined
        ) {
            const invoiced: Record<string, unknown> = {};
            if (parsed.invoicedFromMonth !== undefined) invoiced.fromMonth = parsed.invoicedFromMonth;
            if (parsed.invoicedToMonth !== undefined) invoiced.toMonth = parsed.invoicedToMonth;
            if (parsed.invoicedMinTotal !== undefined) invoiced.minTotal = parsed.invoicedMinTotal;
            if (parsed.invoicedMaxTotal !== undefined) invoiced.maxTotal = parsed.invoicedMaxTotal;
            spend.invoiced = invoiced;
        }

        if (Object.keys(spend).length > 0) filters.spend = spend;
        if (parsed.contractsActive) filters.contracts = { active: true };

        const body: Record<string, unknown> = { filters };
        if (parsed.pageSize !== undefined) body.pageSize = parsed.pageSize;
        if (parsed.pageToken) body.pageToken = parsed.pageToken;

        const data = await makeConsoleRequest<SearchCustomersResponse>(SEARCH_CUSTOMERS_PATH, token, {
            method: "POST",
            body,
        });

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling search customers request");
    }
}
