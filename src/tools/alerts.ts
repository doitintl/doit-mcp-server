import { z } from "zod";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";
import { ALERTS_SORT_BY_VALUES, ALERTS_SORT_ORDER_VALUES } from "../types/alerts.js";
import type { Alert, AlertsResponse } from "../types/alerts.js";

export const ALERTS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/alerts`;

// Schema definitions
export const ListAlertsArgumentsSchema = z.object({
    sortBy: z.enum(ALERTS_SORT_BY_VALUES).optional().describe("A field by which the results will be sorted."),
    sortOrder: z.enum(ALERTS_SORT_ORDER_VALUES).optional().describe("Sort order: ascending or descending."),
    maxResults: z
        .string()
        .optional()
        .describe("Maximum number of results to return in a single page. Defaults to 500."),
    pageToken: z
        .string()
        .optional()
        .describe("Page token returned by a previous call to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe(
            "Expression for filtering results. Syntax: key:[<value>]. Multiple filters can be joined with |. Available filter keys: owner, name."
        ),
});

// Tool metadata
export const listAlertsTool = {
    name: "list_alerts",
    description:
        "Returns a list of alerts that your account has access to. Alerts are listed in reverse chronological order by default.",
    inputSchema: {
        type: "object",
        properties: {
            sortBy: {
                type: "string",
                enum: [...ALERTS_SORT_BY_VALUES],
                description: "A field by which the results will be sorted.",
            },
            sortOrder: {
                type: "string",
                enum: [...ALERTS_SORT_ORDER_VALUES],
                description: "Sort order: ascending (asc) or descending (desc).",
            },
            maxResults: {
                type: "string",
                description: "Maximum number of results to return in a single page. Defaults to 500.",
            },
            pageToken: {
                type: "string",
                description: "Page token returned by a previous call to request the next page of results.",
            },
            filter: {
                type: "string",
                description:
                    "Expression for filtering results. Syntax: key:[<value>]. Multiple filters joined with |. Available keys: owner, name.",
            },
        },
    },
};

// Schema and metadata for get alert
export const GetAlertArgumentsSchema = z.object({
    id: z.string().describe("The ID of the alert to retrieve."),
});

export const getAlertTool = {
    name: "get_alert",
    description: "Returns a specific alert by ID.",
    inputSchema: {
        type: "object",
        properties: {
            id: {
                type: "string",
                description: "The ID of the alert to retrieve.",
            },
        },
        required: ["id"],
    },
};

export async function handleGetAlertRequest(args: any, token: string) {
    try {
        const { id } = GetAlertArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${ALERTS_BASE_URL}/${id}`;
        try {
            const data = await makeDoitRequest<Alert>(url, token, { method: "GET", customerContext });
            if (!data) {
                return createErrorResponse("Failed to retrieve alert");
            }
            return createSuccessResponse(JSON.stringify(data, null, 2));
        } catch (error) {
            return handleGeneralError(error, "calling get alert API");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling get alert request");
    }
}

// Handle list alerts request
export async function handleListAlertsRequest(args: any, token: string) {
    try {
        const { sortBy, sortOrder, maxResults, pageToken, filter } = ListAlertsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        if (sortBy) params.append("sortBy", sortBy);
        if (sortOrder) params.append("sortOrder", sortOrder);
        if (maxResults) params.append("maxResults", maxResults);
        if (pageToken) params.append("pageToken", pageToken);
        if (filter) params.append("filter", filter);

        const alertsUrl = params.toString() ? `${ALERTS_BASE_URL}?${params.toString()}` : ALERTS_BASE_URL;

        try {
            const alertsData = await makeDoitRequest<AlertsResponse>(alertsUrl, token, {
                method: "GET",
                customerContext,
            });

            if (!alertsData) {
                return createErrorResponse("Failed to retrieve list of alerts from the API");
            }

            const alerts = alertsData.alerts || [];

            const responseData = {
                pageToken: alertsData.pageToken || "",
                rowCount: alertsData.rowCount || 0,
                alerts,
            };

            return createSuccessResponse(JSON.stringify(responseData, null, 2));
        } catch (error) {
            return handleGeneralError(error, "calling list alerts API");
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return createErrorResponse(formatZodError(error));
        }
        return handleGeneralError(error, "handling list alerts request");
    }
}
