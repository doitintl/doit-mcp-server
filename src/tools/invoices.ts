import { z } from "zod";
import {
  createErrorResponse,
  createSuccessResponse,
  handleGeneralError,
  makeDoitRequest,
  formatDate,
} from "../utils/util.js";

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
  pageToken: z
    .string()
    .optional()
    .describe(
      "Token for pagination. Use this to get the next page of results."
    ),
});

// Tool definition
export const listInvoicesTool = {
  name: "list_invoices",
  description:
    "List all current and historical invoices for your organization from the DoiT API.",
  inputSchema: {
    type: "object",
    properties: {
      pageToken: {
        type: "string",
        description:
          "Token for pagination. Use this to get the next page of results.",
      },
    },
  },
};

// Handler for the tool
export async function handleListInvoicesRequest(args: any, token: string) {
  try {
    const params = new URLSearchParams();
    if (args.pageToken) params.append("pageToken", args.pageToken);
    const url = `https://api.doit.com/billing/v1/invoices${
      params.toString() ? `?${params.toString()}` : ""
    }`;
    const data = await makeDoitRequest<InvoicesResponse>(url, token);
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
    "Retrieve the full details of an invoice specified by the invoice number from the DoiT API.",
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
};

// Handler for the tool
export async function handleGetInvoiceRequest(args: any, token: string) {
  try {
    if (!args.id) {
      return createErrorResponse("Invoice ID is required");
    }
    const url = `https://api.doit.com/billing/v1/invoices/${encodeURIComponent(
      args.id
    )}`;
    const data: Invoice | null = await makeDoitRequest<Invoice>(url, token, {
      appendParams: true,
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
