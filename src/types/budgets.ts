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
