import { z } from "zod";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatDate,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const INVOICES_BASE_URL = `${DOIT_API_BASE}/billing/v1/invoices`;

// Invoice interface matching the API response
export interface Invoice {
    id: string;
    invoiceDate: number;
    platform: string;
    dueDate: number;
    status: string;
    totalAmount: number;
    balanceAmount: number;
    currency: string;
    url: string;
}

export interface InvoicesResponse {
    invoices: Invoice[];
    pageToken?: string;
    rowCount: number;
}

// Arguments schema for listing invoices
export const ListInvoicesArgumentsSchema = z.object({
    pageToken: z.string().optional().describe("Token for pagination. Use this to get the next page of results."),
});

// Tool definition
export const listInvoicesTool = {
    name: "list_invoices",
    description:
        "Use this when the user wants to see their invoices, check billing history, or review payment records. Returns a list of invoices with amounts, dates, and status. Do NOT use this for cost analysis (use run_query) or budget tracking (use list_budgets).",
    inputSchema: {
        type: "object",
        properties: {
            pageToken: {
                type: "string",
                description: "Token for pagination. Use this to get the next page of results.",
            },
        },
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading invoices...",
        "openai/toolInvocation/invoked": "Invoices loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// Handler for the tool
export async function handleListInvoicesRequest(args: any, token: string) {
    try {
        const { customerContext } = args;
        const params = new URLSearchParams();
        if (args.pageToken) params.append("pageToken", args.pageToken);
        const url = `${INVOICES_BASE_URL}${params.toString() ? `?${params.toString()}` : ""}`;
        const data = await makeDoitRequest<InvoicesResponse>(url, token, {
            customerContext,
        });
        if (!data) {
            return createErrorResponse("Failed to fetch invoices: No data returned");
        }
        // Format invoiceDate and dueDate for each invoice
        const formattedData = {
            ...data,
            invoices: data.invoices.map((inv) => ({
                ...inv,
                invoiceDateFormatted: formatDate(inv.invoiceDate),
                dueDateFormatted: formatDate(inv.dueDate),
            })),
        };
        return createSuccessResponse(JSON.stringify(formattedData));
    } catch (error) {
        return handleGeneralError(error, "listing invoices");
    }
}

// Arguments schema for getting a single invoice
export const GetInvoiceArgumentsSchema = z.object({
    id: z.string().describe("The ID of the invoice to retrieve"),
});

// Tool definition for getting a single invoice
export const getInvoiceTool = {
    name: "get_invoice",
    description:
        "Use this when the user wants to view details of a specific invoice by its ID. Returns full invoice data including line items and status. Do NOT use this for listing all invoices (use list_invoices) or cost analysis (use run_query).",
    inputSchema: {
        type: "object",
        properties: {
            id: {
                type: "string",
                description: "The ID of the invoice to retrieve.",
            },
        },
        required: ["id"],
    },
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading invoice details...",
        "openai/toolInvocation/invoked": "Invoice details loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// Handler for the tool
export async function handleGetInvoiceRequest(args: any, token: string) {
    try {
        const { customerContext } = args;
        if (!args.id) {
            return createErrorResponse("Invoice ID is required");
        }
        const url = `${INVOICES_BASE_URL}/${encodeURIComponent(args.id)}`;
        const data: Invoice | null = await makeDoitRequest<Invoice>(url, token, {
            appendParams: true,
            customerContext,
        });
        if (!data) {
            return createErrorResponse("Failed to fetch invoice: No data returned");
        }
        // Format invoiceDate and dueDate
        const formattedData = {
            ...data,
            invoiceDateFormatted: formatDate(data.invoiceDate),
            dueDateFormatted: formatDate(data.dueDate),
        };
        return createSuccessResponse(JSON.stringify(formattedData));
    } catch (error) {
        return handleGeneralError(error, "retrieving invoice");
    }
}
