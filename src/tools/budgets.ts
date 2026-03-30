import { z } from "zod";
import type { BudgetDetails, BudgetsResponse } from "../types/budgets.js";
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
    matchByName,
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
    name: z
        .string()
        .optional()
        .describe("Partial name filter (case-insensitive). Returns only budgets whose name contains this string."),
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
        "Use this when the user wants to see their cloud spending budgets or check budget status. Returns a paginated list of budgets with names, amounts, and utilization. Do NOT use this for cost analysis (use run_query) or spending alerts (use list_alerts).",
    inputSchema: zodToMcpInputSchema(ListBudgetsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading budgets...",
        "openai/toolInvocation/invoked": "Budgets loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export const GetBudgetArgumentsSchema = z
    .object({
        id: z.string().min(1).optional().describe("The ID of the budget to retrieve."),
        name: z
            .string()
            .optional()
            .describe("Partial name match (case-insensitive). Used to find the budget when ID is unknown."),
    })
    .refine((d) => d.id || d.name, { message: "Either id or name must be provided." });

export const getBudgetTool = {
    name: "get_budget",
    description:
        "Use this when the user wants to view the details and current utilization of a specific budget. Accepts either the budget ID or a partial name (case-insensitive). Do NOT use this for listing all budgets (use list_budgets) or cost analysis (use run_query).",
    inputSchema: zodToMcpInputSchema(GetBudgetArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Loading budget details...",
        "openai/toolInvocation/invoked": "Budget details loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
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
    email: z.string().email().describe("Email address of the collaborator."),
    role: z
        .enum(COLLABORATOR_ROLE_VALUES)
        .describe(`Role of the collaborator. Accepted values: ${formatEnumValues(COLLABORATOR_ROLE_VALUES)}.`),
});

const BudgetAlertSchema = z.object({
    percentage: z.number().describe("Alert threshold as a percentage of the budget amount."),
});

const SlackChannelSchema = z.object({
    customerId: z.string().optional().describe("Customer ID for the Slack channel."),
    id: z.string().min(1).describe("Slack channel ID (required)."),
    name: z.string().min(1).describe("Slack channel name (required)."),
    shared: z.boolean().optional().describe("Whether the channel is shared."),
    type: z.string().optional().describe("Slack channel type."),
    workspace: z.string().optional().describe("Slack workspace identifier."),
});

const CreateBudgetBaseSchema = z.object({
    name: z.string().min(1).describe("Budget name (required, non-empty)."),
    amount: z.number().positive().optional().describe("Budget period amount. Required if usePrevSpend is false."),
    currency: z
        .enum(CURRENCY_VALUES)
        .describe(`Currency code (required). Accepted values: ${formatEnumValues(CURRENCY_VALUES)}.`),
    type: z
        .enum(BUDGET_TYPE_VALUES)
        .describe(`Budget type (required). Accepted values: ${formatEnumValues(BUDGET_TYPE_VALUES)}.`),
    timeInterval: z
        .enum(BUDGET_TIME_INTERVAL_VALUES)
        .optional()
        .describe(
            `Recurring budget interval. Required for recurring budgets. Accepted values: ${formatEnumValues(BUDGET_TIME_INTERVAL_VALUES)}.`
        ),
    startPeriod: z.number().int().describe("Budget start date as a UNIX timestamp in milliseconds (required)."),
    endPeriod: z
        .number()
        .int()
        .optional()
        .describe(
            "Fixed budget end date as a UNIX timestamp in milliseconds. Required if type is fixed, must not be set for recurring."
        ),
    description: z.string().optional().describe("Budget description."),
    usePrevSpend: z
        .boolean()
        .optional()
        .describe("Use the last period's spend as the target amount for recurring budgets. Defaults to false."),
    growthPerPeriod: z
        .number()
        .nonnegative()
        .optional()
        .describe("Periodical growth percentage in recurring budgets. Must be >= 0. Defaults to 0."),
    metric: z
        .enum(BUDGET_METRIC_VALUES)
        .optional()
        .describe(`Budget metric. Accepted values: ${formatEnumValues(BUDGET_METRIC_VALUES)}. Defaults to cost.`),
    public: z
        .enum(BUDGET_PUBLIC_VALUES)
        .optional()
        .describe(`Public sharing access level. Accepted values: ${formatEnumValues(BUDGET_PUBLIC_VALUES)}.`),
    scopes: z
        .array(BudgetScopeSchema)
        .min(1)
        .optional()
        .describe("Filters that define the scope of the budget. Exactly one of scope or scopes must be provided."),
    scope: z
        .array(z.string())
        .min(1)
        .optional()
        .describe(
            "List of allocations that define the budget scope (deprecated). Exactly one of scope or scopes must be provided."
        ),
    collaborators: z
        .array(CollaboratorSchema)
        .min(1)
        .optional()
        .describe(
            "List of permitted users to view/edit the budget. If provided, must include at least one collaborator with role 'owner'."
        ),
    alerts: z
        .array(BudgetAlertSchema)
        .max(3)
        .optional()
        .describe("List of up to three alert thresholds defined as a percentage of the amount."),
    recipients: z
        .array(z.string().email())
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

const createBudgetRefinements = <T extends z.ZodTypeAny>(schema: T) =>
    schema
        .refine((data: any) => (data.scope && !data.scopes) || (!data.scope && data.scopes), {
            message: "Provide exactly one of 'scope' or 'scopes', not both and not neither",
        })
        .refine((data: any) => data.type !== "fixed" || data.endPeriod !== undefined, {
            message: "'endPeriod' is required when type is 'fixed'",
        })
        .refine((data: any) => data.type !== "recurring" || data.endPeriod === undefined, {
            message: "'endPeriod' must not be set when type is 'recurring'",
        })
        .refine((data: any) => data.type !== "recurring" || data.timeInterval !== undefined, {
            message: "'timeInterval' is required when type is 'recurring'",
        })
        .refine((data: any) => data.usePrevSpend === true || (data.amount !== undefined && data.amount > 0), {
            message: "'amount' is required and must be positive when 'usePrevSpend' is not true",
        })
        .refine((data: any) => !data.collaborators || data.collaborators.some((c: any) => c.role === "owner"), {
            message: "Collaborators must include at least one member with role 'owner'",
        });

export const CreateBudgetArgumentsSchema = createBudgetRefinements(CreateBudgetBaseSchema);

export const createBudgetTool = {
    name: "create_budget",
    description:
        "Use this when the user wants to create a new cloud budget with spending limits and alert thresholds. Requires budget name, currency, type, and start period. Ask the user to confirm the budget parameters before executing. Do NOT use this for viewing existing budgets (use list_budgets or get_budget) or creating alerts (use create_alert).",
    inputSchema: zodToMcpInputSchema(CreateBudgetArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Creating budget...",
        "openai/toolInvocation/invoked": "Budget created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleGetBudgetRequest(args: any, token: string) {
    try {
        const parsed = GetBudgetArgumentsSchema.parse(args);
        const { customerContext } = args;
        let resolvedId = parsed.id;

        if (!resolvedId && parsed.name) {
            const listData = await makeDoitRequest<BudgetsResponse>(
                `${BUDGETS_BASE_URL}?maxResults=200`,
                token,
                { method: "GET", customerContext }
            );
            const items = (listData?.budgets ?? []) as Array<{ id: string; budgetName: string }>;
            const result = matchByName(
                items.map((b) => ({ ...b, name: b.budgetName })),
                parsed.name
            );
            if ("error" in result) return createErrorResponse(result.error);
            // (multiple match case now handled as error by matchByName)
            resolvedId = result.resolved;
        }

        const url = `${BUDGETS_BASE_URL}/${encodeURIComponent(resolvedId!)}`;
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
        const { maxResults, pageToken, filter, name, minCreationTime, maxCreationTime } =
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

        if (name) {
            const q = name.toLowerCase();
            data.budgets = (data.budgets ?? []).filter((b: any) =>
                typeof b.budgetName === "string" && b.budgetName.toLowerCase().includes(q)
            );
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

        const body = { ...parsed };

        const data = await makeDoitRequest<BudgetDetails>(BUDGETS_BASE_URL, token, {
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

const updateBudgetRefinements = <T extends z.ZodTypeAny>(schema: T) =>
    schema
        .refine((data: any) => !(data.scope && data.scopes), {
            message: "Provide at most one of 'scope' or 'scopes', not both",
        })
        .refine((data: any) => data.type !== "recurring" || data.endPeriod === undefined, {
            message: "'endPeriod' must not be set when type is 'recurring'",
        })
        .refine((data: any) => data.type !== "fixed" || data.endPeriod !== undefined, {
            message: "'endPeriod' is required when type is 'fixed'",
        })
        .refine((data: any) => data.type !== "recurring" || data.timeInterval !== undefined, {
            message: "'timeInterval' is required when type is 'recurring'",
        })
        .refine((data: any) => data.usePrevSpend !== false || (typeof data.amount === "number" && data.amount > 0), {
            message: "When 'usePrevSpend' is false, a positive 'amount' is required",
        })
        .refine((data: any) => !data.collaborators || data.collaborators.some((c: any) => c.role === "owner"), {
            message: "Collaborators must include at least one member with role 'owner'",
        });

const UpdateBudgetBaseSchema = CreateBudgetBaseSchema.partial();

export const UpdateBudgetArgumentsSchema = updateBudgetRefinements(
    UpdateBudgetBaseSchema.extend({
        id: z.string().min(1).describe("The ID of the budget to update (required)."),
        name: UpdateBudgetBaseSchema.shape.name.describe("Budget name. Must be non-empty if provided."),
        amount: UpdateBudgetBaseSchema.shape.amount.describe("Budget period amount."),
        currency: UpdateBudgetBaseSchema.shape.currency.describe(
            `Currency code. Accepted values: ${formatEnumValues(CURRENCY_VALUES)}.`
        ),
        type: UpdateBudgetBaseSchema.shape.type.describe(
            `Budget type. Accepted values: ${formatEnumValues(BUDGET_TYPE_VALUES)}.`
        ),
        timeInterval: UpdateBudgetBaseSchema.shape.timeInterval.describe(
            `Recurring budget interval. Accepted values: ${formatEnumValues(BUDGET_TIME_INTERVAL_VALUES)}.`
        ),
        startPeriod: UpdateBudgetBaseSchema.shape.startPeriod.describe(
            "Budget start date as a UNIX timestamp in milliseconds."
        ),
        endPeriod: UpdateBudgetBaseSchema.shape.endPeriod.describe(
            "Fixed budget end date as a UNIX timestamp in milliseconds. Must not be set for recurring budgets."
        ),
        scopes: UpdateBudgetBaseSchema.shape.scopes.describe(
            "Filters that define the scope of the budget. Cannot be combined with scope."
        ),
        scope: UpdateBudgetBaseSchema.shape.scope.describe(
            "List of allocations that define the budget scope (deprecated). Cannot be combined with scopes."
        ),
    })
);

export const updateBudgetTool = {
    name: "update_budget",
    description:
        "Use this when the user wants to modify an existing budget. Supports partial updates. Ask the user to confirm the changes before executing. Do NOT use this for viewing budgets (use list_budgets) or creating new budgets (use create_budget).",
    inputSchema: zodToMcpInputSchema(UpdateBudgetArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    // @ts-ignore
    _meta: {
        "openai/toolInvocation/invoking": "Updating budget...",
        "openai/toolInvocation/invoked": "Budget updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleUpdateBudgetRequest(args: any, token: string) {
    try {
        const parsed = UpdateBudgetArgumentsSchema.parse(args);
        const { customerContext } = args;

        const { id, ...body } = parsed;
        const url = `${BUDGETS_BASE_URL}/${encodeURIComponent(id)}`;

        const data = await makeDoitRequest<BudgetDetails>(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update budget");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update budget request");
    }
}
