import { z } from "zod";
import type { Budget, BudgetDetails, BudgetsResponse } from "../types/budgets.js";
import {
    BUDGET_METRIC_VALUES,
    BUDGET_PUBLIC_VALUES,
    BUDGET_TIME_INTERVAL_VALUES,
    BUDGET_TYPE_VALUES,
    COLLABORATOR_ROLE_VALUES,
    CURRENCY_VALUES,
    SCOPE_MODE_VALUES,
    SCOPE_TYPE_VALUES,
} from "../types/budgets.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatEnumValues,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const BUDGETS_BASE_URL = `${DOIT_API_BASE}/analytics/v1/budgets`;

export const DEFAULT_MAX_RESULTS_BUDGETS = "50";

export const ListBudgetsArgumentsSchema = z.object({
    maxResults: z
        .string()
        .optional()
        .describe(
            `The maximum number of results to return in a single page. Defaults to ${DEFAULT_MAX_RESULTS_BUDGETS}.`
        ),
    pageToken: z
        .string()
        .optional()
        .describe("Page token, returned by a previous call, to request the next page of results."),
    filter: z
        .string()
        .optional()
        .describe(
            'An expression for filtering the results. Syntax: "key:[<value>]". Available keys: owner, lastModified in ms (>lastModified). Multiple filters can be connected using a pipe |. Note that using different keys in the same filter results in "AND," while using the same key multiple times in the same filter results in "OR".'
        ),
    minCreationTime: z
        .string()
        .optional()
        .describe(
            "Min value for budget creation time, in milliseconds since the POSIX epoch. Only budgets created after or at this timestamp are returned."
        ),
    maxCreationTime: z
        .string()
        .optional()
        .describe(
            "Max value for budget creation time, in milliseconds since the POSIX epoch. Only budgets created before or at this timestamp are returned."
        ),
});

export const listBudgetsTool = {
    name: "list_budgets",
    description:
        "Returns the list of budgets from the DoiT API that the user has access to. Supports pagination and filtering by owner, last modified time, and creation time range.",
    inputSchema: zodToMcpInputSchema(ListBudgetsArgumentsSchema),
};

export const GetBudgetArgumentsSchema = z.object({
    id: z.string().min(1).describe("The ID of the budget to retrieve."),
});

export const getBudgetTool = {
    name: "get_budget",
    description:
        "Returns the details like current utilization and configuration of the specified budget from the DoiT API.",
    inputSchema: zodToMcpInputSchema(GetBudgetArgumentsSchema),
};

const BudgetScopeSchema = z.object({
    id: z.string().describe("The field to filter on."),
    type: z
        .enum(SCOPE_TYPE_VALUES)
        .describe(`The dimension type. Accepted values: ${formatEnumValues(SCOPE_TYPE_VALUES)}.`),
    mode: z.enum(SCOPE_MODE_VALUES).describe(`Filter mode. Accepted values: ${formatEnumValues(SCOPE_MODE_VALUES)}.`),
    inverse: z.boolean().optional().describe("Set to true to exclude the values."),
    values: z.array(z.string()).optional().describe("Values to filter on."),
});

const CollaboratorSchema = z.object({
    email: z.string().optional().describe("Email address of the collaborator."),
    role: z
        .enum(COLLABORATOR_ROLE_VALUES)
        .optional()
        .describe(`Role of the collaborator. Accepted values: ${formatEnumValues(COLLABORATOR_ROLE_VALUES)}.`),
});

const BudgetAlertSchema = z.object({
    percentage: z.number().optional().describe("Alert threshold as a percentage of the budget amount."),
});

const SlackChannelSchema = z.object({
    customerId: z.string().optional().describe("Customer ID for the Slack channel."),
    id: z.string().optional().describe("Slack channel ID."),
    name: z.string().optional().describe("Slack channel name."),
    shared: z.boolean().optional().describe("Whether the channel is shared."),
    type: z.string().optional().describe("Slack channel type."),
    workspace: z.string().optional().describe("Slack workspace identifier."),
});

export const CreateBudgetArgumentsSchema = z.object({
    name: z.string().describe("Budget name."),
    amount: z.number().optional().describe("Budget period amount. Required if usePrevSpend is false."),
    currency: z
        .enum(CURRENCY_VALUES)
        .optional()
        .describe(`Currency code. Accepted values: ${formatEnumValues(CURRENCY_VALUES)}.`),
    type: z
        .enum(BUDGET_TYPE_VALUES)
        .optional()
        .describe(`Budget type. Accepted values: ${formatEnumValues(BUDGET_TYPE_VALUES)}.`),
    timeInterval: z
        .enum(BUDGET_TIME_INTERVAL_VALUES)
        .optional()
        .describe(`Recurring budget interval. Accepted values: ${formatEnumValues(BUDGET_TIME_INTERVAL_VALUES)}.`),
    startPeriod: z.number().optional().describe("Budget start date as a UNIX timestamp in milliseconds."),
    endPeriod: z
        .number()
        .optional()
        .describe("Fixed budget end date as a UNIX timestamp in milliseconds. Required if type is fixed."),
    description: z.string().optional().describe("Budget description."),
    usePrevSpend: z
        .boolean()
        .optional()
        .describe("Use the last period's spend as the target amount for recurring budgets. Defaults to false."),
    growthPerPeriod: z
        .number()
        .optional()
        .describe("Periodical growth percentage in recurring budgets. Defaults to 0."),
    metric: z
        .enum(BUDGET_METRIC_VALUES)
        .optional()
        .describe(`Budget metric. Accepted values: ${formatEnumValues(BUDGET_METRIC_VALUES)}. Defaults to cost.`),
    public: z
        .enum(BUDGET_PUBLIC_VALUES)
        .optional()
        .describe(`Public sharing access level. Accepted values: ${formatEnumValues(BUDGET_PUBLIC_VALUES)}.`),
    scopes: z.array(BudgetScopeSchema).optional().describe("Filters that define the scope of the budget."),
    scope: z
        .array(z.string())
        .optional()
        .describe("List of allocations that define the budget scope (deprecated, use scopes instead)."),
    collaborators: z.array(CollaboratorSchema).optional().describe("List of permitted users to view/edit the budget."),
    alerts: z
        .array(BudgetAlertSchema)
        .optional()
        .describe("List of up to three alert thresholds defined as a percentage of the amount."),
    recipients: z
        .array(z.string())
        .optional()
        .describe("List of email addresses to notify when reaching an alert threshold."),
    recipientsSlackChannels: z
        .array(SlackChannelSchema)
        .optional()
        .describe("List of Slack channels to notify when reaching an alert threshold."),
    seasonalAmounts: z
        .array(z.number())
        .optional()
        .describe("List of seasonal amounts for recurring budgets with different amounts per period."),
});

export const createBudgetTool = {
    name: "create_budget",
    description:
        "Creates a new budget in the DoiT platform to track actual cloud spend against planned spend. Supports recurring and fixed budget types with configurable scopes, alerts, and collaborators.",
    inputSchema: zodToMcpInputSchema(CreateBudgetArgumentsSchema),
};

export async function handleGetBudgetRequest(args: any, token: string) {
    try {
        const { id } = GetBudgetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${BUDGETS_BASE_URL}/${encodeURIComponent(id)}`;
        const data = await makeDoitRequest<BudgetDetails>(url, token, { method: "GET", customerContext });
        if (!data) {
            return createErrorResponse("Failed to retrieve budget details");
        }
        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get budget request");
    }
}

export async function handleListBudgetsRequest(args: any, token: string) {
    try {
        const { maxResults, pageToken, filter, minCreationTime, maxCreationTime } =
            ListBudgetsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const params = new URLSearchParams();
        params.append("maxResults", maxResults || DEFAULT_MAX_RESULTS_BUDGETS);
        if (pageToken) params.append("pageToken", pageToken);
        if (filter) params.append("filter", filter);
        if (minCreationTime) params.append("minCreationTime", minCreationTime);
        if (maxCreationTime) params.append("maxCreationTime", maxCreationTime);

        const url = `${BUDGETS_BASE_URL}?${params}`;

        const data = await makeDoitRequest<BudgetsResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve budgets");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list budgets request");
    }
}

export async function handleCreateBudgetRequest(args: any, token: string) {
    try {
        const parsed = CreateBudgetArgumentsSchema.parse(args);
        const { customerContext } = args;

        const body: Record<string, any> = { name: parsed.name };
        if (parsed.amount !== undefined) body.amount = parsed.amount;
        if (parsed.currency !== undefined) body.currency = parsed.currency;
        if (parsed.type !== undefined) body.type = parsed.type;
        if (parsed.timeInterval !== undefined) body.timeInterval = parsed.timeInterval;
        if (parsed.startPeriod !== undefined) body.startPeriod = parsed.startPeriod;
        if (parsed.endPeriod !== undefined) body.endPeriod = parsed.endPeriod;
        if (parsed.description !== undefined) body.description = parsed.description;
        if (parsed.usePrevSpend !== undefined) body.usePrevSpend = parsed.usePrevSpend;
        if (parsed.growthPerPeriod !== undefined) body.growthPerPeriod = parsed.growthPerPeriod;
        if (parsed.metric !== undefined) body.metric = parsed.metric;
        if (parsed.public !== undefined) body.public = parsed.public;
        if (parsed.scopes !== undefined) body.scopes = parsed.scopes;
        if (parsed.scope !== undefined) body.scope = parsed.scope;
        if (parsed.collaborators !== undefined) body.collaborators = parsed.collaborators;
        if (parsed.alerts !== undefined) body.alerts = parsed.alerts;
        if (parsed.recipients !== undefined) body.recipients = parsed.recipients;
        if (parsed.recipientsSlackChannels !== undefined) body.recipientsSlackChannels = parsed.recipientsSlackChannels;
        if (parsed.seasonalAmounts !== undefined) body.seasonalAmounts = parsed.seasonalAmounts;

        const data = await makeDoitRequest<Budget>(BUDGETS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create budget");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create budget request");
    }
}
