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
