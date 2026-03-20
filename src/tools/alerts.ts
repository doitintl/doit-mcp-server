import { z } from "zod";
import type { Alert, AlertsResponse } from "../types/alerts.js";
import {
    ALERT_OPERATOR_VALUES,
    ALERT_SCOPE_MODE_VALUES,
    ALERT_SCOPE_TYPE_VALUES,
    ALERT_TIME_INTERVAL_VALUES,
    ALERTS_SORT_BY_VALUES,
    ALERTS_SORT_ORDER_VALUES,
} from "../types/alerts.js";
import { CURRENCY_VALUES } from "../types/budgets.js";
import { customerContextProperty, zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatEnumValues,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const ALERTS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/alerts`;
const DEFAULT_LIST_ALERTS_MAX_RESULTS = 40;

// Schema definitions
export const ListAlertsArgumentsSchema = z.object({
    sortBy: z.enum(ALERTS_SORT_BY_VALUES).optional().describe("A field by which the results will be sorted."),
    sortOrder: z.enum(ALERTS_SORT_ORDER_VALUES).optional().describe("Sort order: ascending or descending."),
    maxResults: z.string().optional().describe("Maximum number of results to return in a single page."),
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
        "Returns a list of alerts from DoIT API that your account has access to. Alerts are listed in reverse chronological order by default.",
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
                description: "Maximum number of results to return in a single page",
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
            ...customerContextProperty,
        },
    },
};

// Schema and metadata for get alert
export const GetAlertArgumentsSchema = z.object({
    id: z.string().describe("The ID of the alert to retrieve."),
});

export const getAlertTool = {
    name: "get_alert",
    description: "Returns details of a specific alert from DoIT API by ID.",
    inputSchema: {
        type: "object",
        properties: {
            id: {
                type: "string",
                description: "The ID of the alert to retrieve.",
            },
            ...customerContextProperty,
        },
        required: ["id"],
    },
};

export async function handleGetAlertRequest(args: any, token: string) {
    try {
        const { id } = GetAlertArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${ALERTS_BASE_URL}/${encodeURIComponent(id)}`;
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
        const maxResultsValue = maxResults ? parseInt(maxResults, 10) : DEFAULT_LIST_ALERTS_MAX_RESULTS;
        const { customerContext } = args;

        const params = new URLSearchParams({
            maxResults: maxResultsValue.toString(),
        });
        if (sortBy) params.append("sortBy", sortBy);
        if (sortOrder) params.append("sortOrder", sortOrder);
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
                ...(alertsData.pageToken !== undefined && { pageToken: alertsData.pageToken }),
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

// Create alert schemas

const AlertMetricSchema = z.object({
    type: z.string().min(1).describe("Metric type identifier (e.g., 'basic', 'custom', 'extended')."),
    value: z.string().min(1).describe("Metric value identifier (e.g., 'cost', 'usage', 'savings')."),
});

const AlertScopeSchema = z.object({
    id: z.string().describe("The field to filter on."),
    type: z
        .enum(ALERT_SCOPE_TYPE_VALUES)
        .describe(`The dimension type. Accepted values: ${formatEnumValues(ALERT_SCOPE_TYPE_VALUES)}.`),
    mode: z
        .enum(ALERT_SCOPE_MODE_VALUES)
        .describe(`Filter mode. Accepted values: ${formatEnumValues(ALERT_SCOPE_MODE_VALUES)}.`),
    inverse: z.boolean().optional().describe("Set to true to exclude the values."),
    values: z.array(z.string()).optional().describe("Values to filter on."),
});

const AlertConfigSchema = z.object({
    metric: AlertMetricSchema.describe("The metric to evaluate (required). Object with 'type' and 'value' fields."),
    timeInterval: z
        .enum(ALERT_TIME_INTERVAL_VALUES)
        .describe(
            `The time interval to evaluate the condition (required). Accepted values: ${formatEnumValues(ALERT_TIME_INTERVAL_VALUES)}.`
        ),
    value: z.number().describe("The alert threshold value (required)."),
    condition: z.string().optional().describe("Condition type (e.g., 'value', 'forecasted', 'percentage')."),
    currency: z
        .enum(CURRENCY_VALUES)
        .optional()
        .describe(`Currency code. Accepted values: ${formatEnumValues(CURRENCY_VALUES)}.`),
    operator: z
        .enum(ALERT_OPERATOR_VALUES)
        .optional()
        .describe(`Comparison operator. Accepted values: ${formatEnumValues(ALERT_OPERATOR_VALUES)}.`),
    evaluateForEach: z.string().optional().describe("Add a dimension to break down the evaluation of the condition."),
    scopes: z.array(AlertScopeSchema).optional().describe("Filters that define the scope of the alert."),
    dataSource: z.string().optional().describe("The data source for the alert (e.g., 'billing')."),
});

export const CreateAlertArgumentsSchema = z.object({
    name: z.string().min(1).describe("Alert name (required, non-empty)."),
    config: AlertConfigSchema.describe("Parameters that define when and how the alert is evaluated (required)."),
    recipients: z
        .array(z.string().email())
        .optional()
        .describe("List of email addresses to notify when the alert is triggered."),
});

export const createAlertTool = {
    name: "create_alert",
    description:
        "Creates a new alert in the DoiT platform to notify when cloud costs exceed defined thresholds or meet specific conditions.",
    inputSchema: zodToMcpInputSchema(CreateAlertArgumentsSchema),
};

export async function handleCreateAlertRequest(args: any, token: string) {
    try {
        const parsed = CreateAlertArgumentsSchema.parse(args);
        const { customerContext } = args;

        const body = { ...parsed };

        const data = await makeDoitRequest<Alert>(ALERTS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create alert");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create alert request");
    }
}

// Unlike update_budget (which uses .partial()), config is required here because
// the public AlertUpdateRequest contract explicitly requires it.
export const UpdateAlertArgumentsSchema = z.object({
    id: z.string().min(1).describe("The ID of the alert to update (required)."),
    config: AlertConfigSchema.describe("Parameters that define when and how the alert is evaluated (required)."),
    name: z.string().min(1).optional().describe("Alert name. Must be non-empty if provided."),
    recipients: z
        .array(z.string().email())
        .optional()
        .describe("List of email addresses to notify when the alert is triggered."),
});

export const updateAlertTool = {
    name: "update_alert",
    description:
        "Updates an existing alert in the DoiT platform. The alert ID and config are required. Name and recipients are optional.",
    inputSchema: zodToMcpInputSchema(UpdateAlertArgumentsSchema),
};

export async function handleUpdateAlertRequest(args: any, token: string) {
    try {
        const parsed = UpdateAlertArgumentsSchema.parse(args);
        const { customerContext } = args;

        const { id, ...body } = parsed;
        const url = `${ALERTS_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest<Alert>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) return createErrorResponse("Failed to update alert");

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update alert request");
    }
}
