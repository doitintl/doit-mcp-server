/**
 * Widget column configuration — the single place to control what each tool's
 * widget view displays. Changes here take effect on the next tool call with no
 * widget rebuild required.
 *
 * Format types are a closed enum; the widget's renderCell() handles each one.
 * To add a new format type, add it here AND update GenericTable.tsx, then rebuild.
 */

export type ColumnFormat =
    | "text"      // default — String(value)
    | "currency"  // $N.NN
    | "date"      // toLocaleDateString from ISO string or ms epoch
    | "datetime"  // toLocaleString
    | "severity"  // coloured text: critical/warning/info
    | "status"    // coloured text: active/inactive/resolved/etc
    | "boolean"   // Yes / No
    | "icon"      // SVG icon mapped from cell value; requires formatOptions.iconSet
    | "progress"  // progress bar; requires formatOptions.maxKey or maxValue
    | "sparkline" // inline SVG mini line-chart from an array of numbers
    | "image";    // <img> rendered from URL value

export interface ColumnFormatOptions {
    /** For "icon": name of a predefined icon set registered in the widget (e.g. "cloud-platform") */
    iconSet?: string;
    /** For "progress": sibling field key whose value is the denominator */
    maxKey?: string;
    /** For "progress": static denominator when maxKey is unavailable */
    maxValue?: number;
}

export interface ColumnDef {
    key: string;
    label: string;
    format?: ColumnFormat;
    formatOptions?: ColumnFormatOptions;
}

export interface DrilldownConfig {
    /** Tool name to invoke when a row is clicked */
    tool: string;
    /** Field key in the row item to pass as the tool arg */
    idKey: string;
    /** Arg name to pass to the tool (defaults to "id") */
    argKey?: string;
    /** Human-readable prompt template; {id} is replaced with the row's id value */
    promptTemplate?: string;
}

export interface ToolViewConfig {
    columns: ColumnDef[];
    emptyMessage?: string;
    drilldown?: DrilldownConfig;
}

export const TOOL_VIEW_CONFIG: Record<string, ToolViewConfig> = {
    // ── Anomalies ──────────────────────────────────────────────────────────────
    get_anomalies: {
        columns: [
            { key: "platform",      label: "Cloud",    format: "icon", formatOptions: { iconSet: "cloud-platform" } },
            { key: "serviceName",   label: "Service" },
            { key: "scope",         label: "Scope" },
            { key: "costOfAnomaly", label: "Cost",     format: "currency" },
            { key: "severityLevel", label: "Severity", format: "severity" },
            { key: "status",        label: "Status",   format: "status" },
            { key: "startTime",     label: "Started",  format: "date" },
        ],
        emptyMessage: "No anomalies found.",
        drilldown: {
            tool: "get_anomaly",
            idKey: "id",
            promptTemplate: "Show me details for anomaly {id}",
        },
    },
    get_anomaly: {
        columns: [
            { key: "anomalyChartUrl", label: "Chart",       format: "image" },
            { key: "platform",        label: "Cloud",        format: "icon", formatOptions: { iconSet: "cloud-platform" } },
            { key: "serviceName",     label: "Service" },
            { key: "scope",           label: "Scope" },
            { key: "costOfAnomaly",   label: "Cost",         format: "currency" },
            { key: "severityLevel",   label: "Severity",     format: "severity" },
            { key: "status",          label: "Status",       format: "status" },
            { key: "startTime",       label: "Started",      format: "date" },
            { key: "endTime",         label: "Ended",        format: "date" },
            { key: "acknowledged",    label: "Acknowledged", format: "boolean" },
        ],
    },

    // ── Budgets ────────────────────────────────────────────────────────────────
    list_budgets: {
        columns: [
            { key: "budgetName",         label: "Name" },
            { key: "currentUtilization", label: "Utilization", format: "progress", formatOptions: { maxKey: "amount" } },
            { key: "amount",             label: "Budget",      format: "currency" },
            { key: "currency",           label: "Currency" },
            { key: "timeInterval",       label: "Period" },
            { key: "owner",              label: "Owner" },
        ],
        emptyMessage: "No budgets found.",
    },
    get_budget: {
        columns: [
            { key: "name",               label: "Name" },
            { key: "currentUtilization", label: "Utilization", format: "progress", formatOptions: { maxKey: "amount" } },
            { key: "amount",             label: "Budget",      format: "currency" },
            { key: "currency",           label: "Currency" },
            { key: "type",               label: "Type" },
            { key: "timeInterval",       label: "Period" },
            { key: "metric",             label: "Metric" },
            { key: "owner",              label: "Owner" },
            { key: "createTime",         label: "Created",     format: "date" },
        ],
    },

    // ── Invoices ───────────────────────────────────────────────────────────────
    list_invoices: {
        columns: [
            { key: "platform",            label: "Platform" },
            { key: "invoiceDateFormatted", label: "Invoice Date" },
            { key: "dueDateFormatted",     label: "Due Date" },
            { key: "totalAmount",          label: "Total",   format: "currency" },
            { key: "balanceAmount",        label: "Balance", format: "currency" },
            { key: "currency",             label: "Currency" },
            { key: "status",               label: "Status",  format: "status" },
        ],
        emptyMessage: "No invoices found.",
    },
    get_invoice: {
        columns: [
            { key: "platform",            label: "Platform" },
            { key: "invoiceDateFormatted", label: "Invoice Date" },
            { key: "dueDateFormatted",     label: "Due Date" },
            { key: "totalAmount",          label: "Total",   format: "currency" },
            { key: "balanceAmount",        label: "Balance", format: "currency" },
            { key: "currency",             label: "Currency" },
            { key: "status",               label: "Status",  format: "status" },
        ],
    },

    // ── Support Tickets ────────────────────────────────────────────────────────
    list_tickets: {
        columns: [
            { key: "subject",   label: "Subject" },
            { key: "platform",  label: "Platform" },
            { key: "product",   label: "Product" },
            { key: "severity",  label: "Severity", format: "severity" },
            { key: "status",    label: "Status",   format: "status" },
            { key: "requester", label: "Requester" },
            { key: "createTime", label: "Created", format: "date" },
        ],
        emptyMessage: "No support tickets found.",
    },

    // ── Cloud Incidents ────────────────────────────────────────────────────────
    get_cloud_incidents: {
        columns: [
            { key: "platform", label: "Platform" },
            { key: "product",  label: "Product" },
            { key: "title",    label: "Title" },
            { key: "status",   label: "Status",  format: "status" },
            { key: "createTime", label: "Created", format: "date" },
        ],
        emptyMessage: "No cloud incidents found.",
    },
    get_cloud_incident: {
        columns: [
            { key: "platform",    label: "Platform" },
            { key: "product",     label: "Product" },
            { key: "title",       label: "Title" },
            { key: "status",      label: "Status",  format: "status" },
            { key: "summary",     label: "Summary" },
            { key: "symptoms",    label: "Symptoms" },
            { key: "workaround",  label: "Workaround" },
            { key: "createTime",  label: "Created", format: "date" },
        ],
    },

    // ── Assets ─────────────────────────────────────────────────────────────────
    list_assets: {
        columns: [
            { key: "name",     label: "Name" },
            { key: "type",     label: "Type" },
            { key: "quantity", label: "Quantity" },
            { key: "createTime", label: "Created", format: "date" },
        ],
        emptyMessage: "No assets found.",
    },
    get_asset: {
        columns: [
            { key: "name",     label: "Name" },
            { key: "type",     label: "Type" },
            { key: "quantity", label: "Quantity" },
            { key: "createTime", label: "Created", format: "date" },
        ],
    },

    // ── User validation ────────────────────────────────────────────────────────
    validate_user: {
        columns: [
            { key: "email",  label: "Email" },
            { key: "domain", label: "Domain" },
        ],
    },
};
