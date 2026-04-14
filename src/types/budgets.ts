export const BUDGET_TYPE_VALUES = ["fixed", "recurring"] as const;
export const BUDGET_TIME_INTERVAL_VALUES = ["day", "week", "month", "quarter", "year"] as const;
export const BUDGET_METRIC_VALUES = ["cost", "amortized_cost"] as const;
export const BUDGET_PUBLIC_VALUES = ["owner", "editor", "viewer"] as const;
export const COLLABORATOR_ROLE_VALUES = ["owner", "editor", "viewer"] as const;
export const SCOPE_MODE_VALUES = ["is", "starts_with", "ends_with", "contains", "regexp"] as const;
export const SCOPE_TYPE_VALUES = [
    "datetime",
    "fixed",
    "optional",
    "label",
    "tag",
    "project_label",
    "system_label",
    "attribution",
    "attribution_group",
    "allocation",
    "allocation_rule",
    "gke",
    "gke_label",
    "organization_tag",
] as const;
export const CURRENCY_VALUES = [
    "USD",
    "ILS",
    "EUR",
    "AUD",
    "CAD",
    "GBP",
    "DKK",
    "NOK",
    "SEK",
    "BRL",
    "SGD",
    "MXN",
    "CHF",
    "MYR",
    "TWD",
    "EGP",
    "ZAR",
    "JPY",
    "IDR",
    "AED",
    "THB",
    "COP",
] as const;

export type BudgetAlertThreshold = {
    amount: number;
    percentage: number;
};

export type BudgetScope = {
    id: string;
    type: string;
    mode: string;
    inverse?: boolean;
    values: string[];
};

export type BudgetItem = {
    alertThresholds?: BudgetAlertThreshold[];
    amount: number;
    budgetName: string;
    createTime: number;
    currency: string;
    currentUtilization?: number;
    endPeriod?: number;
    forecastedUtilizationDate?: number;
    id: string;
    owner: string;
    scopes?: BudgetScope[];
    startPeriod?: number;
    timeInterval?: string;
    updateTime: number;
    url?: string;
};

export type BudgetsResponse = {
    budgets: BudgetItem[];
    pageToken?: string;
    rowCount: number;
};

export type BudgetAlert = {
    forecastedDate?: number;
    percentage?: number;
    triggered?: boolean;
};

export type BudgetCollaborator = {
    email?: string;
    role?: string;
};

export type BudgetSlackChannel = {
    customerId?: string;
    id: string;
    name: string;
    shared?: boolean;
    type?: string;
    workspace?: string;
};

export type BudgetDetails = {
    alerts?: BudgetAlert[];
    amount?: number;
    seasonalAmounts?: number[];
    collaborators?: BudgetCollaborator[];
    createTime?: number;
    currency: string;
    currentUtilization?: number;
    description?: string;
    endPeriod?: number;
    forecastedUtilization?: number;
    growthPerPeriod?: number;
    id: string;
    metric?: string;
    name: string;
    public?: string;
    recipients?: string[];
    recipientsSlackChannels?: BudgetSlackChannel[];
    scope?: string[];
    scopes: BudgetScope[];
    startPeriod?: number;
    timeInterval?: string;
    type: string;
    updateTime?: number;
    usePrevSpend?: boolean;
};
