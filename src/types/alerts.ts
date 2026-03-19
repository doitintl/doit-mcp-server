export const ALERTS_SORT_BY_VALUES = ["name", "createTime", "updateTime", "lastAlerted"] as const;
export const ALERTS_SORT_ORDER_VALUES = ["asc", "desc"] as const;

export const ALERT_TIME_INTERVAL_VALUES = ["hour", "day", "week", "month", "quarter", "year"] as const;
export const ALERT_OPERATOR_VALUES = ["gt", "lt"] as const;
export const ALERT_SCOPE_TYPE_VALUES = [
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
] as const;
export const ALERT_SCOPE_MODE_VALUES = ["is", "starts_with", "ends_with", "contains", "regexp"] as const;

export type AlertMetric = {
    type: string;
    value: string;
};

export type AlertScopeType =
    | "datetime"
    | "fixed"
    | "optional"
    | "label"
    | "tag"
    | "project_label"
    | "system_label"
    | "attribution"
    | "attribution_group"
    | "allocation"
    | "allocation_rule"
    | "gke"
    | "gke_label";

export type AlertScopeMode = "is" | "starts_with" | "ends_with" | "contains" | "regexp";

export type AlertScope = {
    id: string;
    type: AlertScopeType;
    mode: AlertScopeMode;
    inverse?: boolean;
    values?: string[];
};

export type AlertConfig = {
    condition: string;
    currency: string;
    metric: AlertMetric;
    operator: string;
    evaluateForEach: string;
    scopes: AlertScope[];
    timeInterval: string;
    dataSource: string;
    value: number;
};

export type Alert = {
    id: string;
    name: string;
    createTime: number;
    updateTime: number;
    lastAlerted: number | null;
    recipients: string[];
    config: AlertConfig;
};

export type AlertsResponse = {
    pageToken?: string;
    rowCount: number;
    alerts: Alert[];
};
