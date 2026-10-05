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
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatEnumValues,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
    matchByName,
} from "../utils/util.js";

export const ALERTS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/alerts`;
const DEFAULT_LIST_ALERTS_MAX_RESULTS = 40;

// Schema definitions
export const ListAlertsArgumentsSchema = z.object({
    sortBy: z.enum(ALERTS_SORT_BY_VALUES).optional().describe("A field by which the results will be sorted."),
    sortOrder: z
        .enum(ALERTS_SORT_ORDER_VALUES)
        .optional()
        .describe("Sort order: ascending (asc) or descending (desc)."),
    maxResults: z
        .string()
        .optional()
        .describe(
            "Maximum results per page. Tool default 40; valid range 1–500. Out-of-range values fall back to 50 at the API."
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Page token returned by a previous call to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe(
            "Exact, case-sensitive filters: owner (email) or name. Use key:value and join distinct keys with | (AND). Repeated keys are rejected. Example: owner:user@example.com|name:Daily costs."
        ),
});

// Tool metadata
export const listAlertsTool = {
    name: "list_alerts",
    title: "List alerts",
    coversEndpoint: "get:/analytics/v1/alerts",
    description:
        "Use this when the user wants to see their cost alerts or check alert configurations. Returns a paginated list of alerts. Do NOT use this for anomaly detection (use get_anomalies) or budget tracking (use list_budgets).",
    inputSchema: zodToMcpInputSchema(ListAlertsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading alerts...",
        "openai/toolInvocation/invoked": "Alerts loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

// Schema and metadata for get alert
export const GetAlertArgumentsSchema = z
    .object({
        id: z.string().optional().describe("The ID of the alert to retrieve."),
        name: z
            .string()
            .optional()
            .describe(
                "Case-insensitive partial name lookup in the 200 most recent alerts only. Multiple matches return an ambiguity error. ID takes precedence."
            ),
    })
    .refine((d) => d.id || d.name, { message: "Either id or name must be provided." });

export const getAlertTool = {
    name: "get_alert",
    title: "Get alert",
    coversEndpoint: "get:/analytics/v1/alerts/{id}",
    description:
        "Use this when the user wants to view the details of a specific cost alert. Accepts either the alert ID or a partial name (case-insensitive). Do NOT use this for listing all alerts (use list_alerts) or anomalies (use get_anomalies).",
    inputSchema: zodToMcpInputSchema(GetAlertArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading alert details...",
        "openai/toolInvocation/invoked": "Alert details loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetAlertRequest(args: any, token: string) {
    try {
        const parsed = GetAlertArgumentsSchema.parse(args);
        const { customerContext } = args;
        let resolvedId = parsed.id;

        if (!resolvedId && parsed.name) {
            const listData = await makeDoitRequest<AlertsResponse>(`${ALERTS_BASE_URL}?maxResults=200`, token, {
                method: "GET",
                customerContext,
            });
            const items = listData?.alerts ?? [];
            const result = matchByName(items, parsed.name);
            if ("error" in result) return createErrorResponse(result.error);
            // (multiple match case now handled as error by matchByName)
            resolvedId = result.resolved;
        }

        const url = `${ALERTS_BASE_URL}/${encodeURIComponent(resolvedId as string)}`;
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
        .optional()
        .describe(
            `Filter mode; defaults to 'is' at the API. Accepted values: ${formatEnumValues(ALERT_SCOPE_MODE_VALUES)}.`
        ),
    inverse: z.boolean().optional().describe("Set to true to exclude the values."),
    values: z.array(z.string()).optional().describe("Values to filter on."),
});

const AlertConfigSchema = z.object({
    metric: AlertMetricSchema.describe(
        "The metric to evaluate; required on create. Object with 'type' and 'value' fields."
    ),
    timeInterval: z
        .enum(ALERT_TIME_INTERVAL_VALUES)
        .describe(
            `The time interval to evaluate the condition; required on create. Accepted values: ${formatEnumValues(ALERT_TIME_INTERVAL_VALUES)}.`
        ),
    value: z.number().describe("The alert threshold value; required on create."),
    condition: z
        .enum(["value", "percentage-change", "forecast"])
        .optional()
        .describe("Condition type; defaults to percentage-change on create. Omitted on update means unchanged."),
    currency: z
        .enum(CURRENCY_VALUES)
        .optional()
        .describe(
            `Currency code; defaults to the customer's currency on create, unchanged when omitted on update. Accepted values: ${formatEnumValues(CURRENCY_VALUES)}.`
        ),
    operator: z
        .enum(ALERT_OPERATOR_VALUES)
        .describe(`Comparison operator. Accepted values: ${formatEnumValues(ALERT_OPERATOR_VALUES)}.`),
    evaluateForEach: z.string().optional().describe("Add a dimension to break down the evaluation of the condition."),
    scopes: z
        .array(AlertScopeSchema)
        .optional()
        .describe("Filters that define the scope of the alert. On update, omit to preserve; [] clears the scopes."),
    dataSource: z
        .enum(["billing", "billing-datahub", "kubernetes-utilization", "tokenomics"])
        .optional()
        .describe("Data source; defaults to billing on create. Omitted on update means unchanged."),
});

export const CreateAlertArgumentsSchema = z.object({
    name: z.string().min(1).max(64).describe("Alert name (required, 1–64 characters)."),
    config: AlertConfigSchema.describe("Parameters that define when and how the alert is evaluated (required)."),
    recipients: z
        .array(z.string().email())
        .optional()
        .describe(
            "Email addresses to notify when triggered. On create, defaults to the caller's email; omitted on update preserves recipients. The API requires at least one email or existing Slack destination."
        ),
});

export const createAlertTool = {
    name: "create_alert",
    title: "Create alert",
    coversEndpoint: "post:/analytics/v1/alerts",
    description:
        "Use this when the user wants to set up a new cost alert with thresholds and notification settings. Changes apply immediately. Do NOT use this for creating budgets (use create_budget) or viewing existing alerts (use list_alerts).",
    inputSchema: zodToMcpInputSchema(CreateAlertArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Creating alert...",
        "openai/toolInvocation/invoked": "Alert created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
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

export const UpdateAlertArgumentsSchema = z.object({
    id: z.string().min(1).describe("The ID of the alert to update (required)."),
    config: AlertConfigSchema.partial()
        .optional()
        .describe(
            "Only configuration fields to change. Omitted fields are preserved; a supplied metric requires both type and value."
        ),
    name: z.string().min(1).optional().describe("Alert name. Must be non-empty if provided."),
    recipients: z
        .array(z.string().email())
        .optional()
        .describe(
            "Email addresses to notify when triggered. On create, defaults to the caller's email; omitted on update preserves recipients. The API requires at least one email or existing Slack destination."
        ),
});

export const updateAlertTool = {
    name: "update_alert",
    title: "Update alert",
    coversEndpoint: "patch:/analytics/v1/alerts/{id}",
    description:
        "Use this when the user wants to modify an existing cost alert. Supports partial updates, including name-only, recipients-only, or individual config fields. Omitted fields are preserved; scopes: [] clears scopes. Changes apply immediately. Do NOT use this for creating new alerts (use create_alert) or budgets (use create_budget).",
    inputSchema: zodToMcpInputSchema(UpdateAlertArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Updating alert...",
        "openai/toolInvocation/invoked": "Alert updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
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
