export const DIMENSION_TYPE_VALUES = [
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

export const FILTER_MODE_VALUES = ["is", "starts_with", "ends_with", "contains", "regexp"] as const;

export const METRIC_TYPE_VALUES = ["basic", "custom", "extended"] as const;

export const AGGREGATION_VALUES = ["total", "percent_total", "percent_col", "percent_row"] as const;

export const TIME_INTERVAL_VALUES = [
    "hour",
    "day",
    "dayCumSum",
    "week",
    "isoweek",
    "month",
    "quarter",
    "year",
    "week_day",
] as const;

export const TIME_RANGE_MODE_VALUES = ["last", "current", "custom"] as const;

export const TIME_UNIT_VALUES = ["day", "week", "month", "quarter", "year"] as const;

export const SECONDARY_TIME_UNIT_VALUES = ["day", "month", "quarter", "year"] as const;

export const SORT_VALUES = ["asc", "desc", "a_to_z"] as const;

export const METRIC_FILTER_OPERATOR_VALUES = ["gt", "lt", "lte", "gte", "b", "nb", "e", "ne"] as const;

export const DISPLAY_VALUES = [
    "actuals_only",
    "absolute_change",
    "percentage_change",
    "absolute_and_percentage",
] as const;

export const DATA_SOURCE_VALUES = ["billing", "bqlens", "billing-datahub", "kubernetes-utilization"] as const;

export const LAYOUT_VALUES = [
    "column_chart",
    "stacked_column_chart",
    "bar_chart",
    "stacked_bar_chart",
    "line_chart",
    "spline_chart",
    "area_chart",
    "area_spline_chart",
    "stacked_area_chart",
    "treemap_chart",
    "table",
    "table_heatmap",
    "table_row_heatmap",
    "table_col_heatmap",
    "csv_export",
    "sheets_export",
] as const;

export const REPORT_CURRENCY_VALUES = [
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

export const SPLIT_MODE_VALUES = ["even", "custom", "proportional"] as const;

export const ORIGIN_TYPE_VALUES = [
    "datetime",
    "fixed",
    "optional",
    "label",
    "tag",
    "project_label",
    "system_label",
    "attribution",
    "attribution_group",
    "gke",
    "gke_label",
    "organization_tag",
    "unallocated",
] as const;
