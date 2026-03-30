/**
 * Demo data for the "demo_key" token.
 *
 * When makeDoitRequest is called with token === "demo_key", getDemoResponse()
 * is called first. If it returns non-null, that value is used directly and
 * no real HTTP request is made. This lets OpenAI app reviewers explore the
 * MCP server without a real DoiT account.
 *
 * Fake customer: Acme Corp (acme.io) — GCP + AWS multi-cloud setup.
 */

// ── shared helpers ─────────────────────────────────────────────────────────────

function pathOf(url: string): string {
    try {
        return new URL(url).pathname;
    } catch {
        // url may lack origin in some test contexts
        const m = url.match(/^(?:https?:\/\/[^/]+)?(\/[^?]*)/);
        return m ? m[1] : url;
    }
}

// ── demo fixtures ──────────────────────────────────────────────────────────────

const DEMO_USER = {
    email: "demo@acme.io",
    name: "Demo User",
    domain: "acme.io",
};

const DEMO_ANOMALIES = [
    {
        id: "anom-001",
        platform: "google-cloud",
        scope: "acme-prod",
        serviceName: "Compute Engine",
        costOfAnomaly: 3590.5,
        severityLevel: "high",
        status: "open",
        startTime: "2026-03-28T00:00:00Z",
        endTime: "2026-03-28T23:59:59Z",
    },
    {
        id: "anom-002",
        platform: "amazon-web-services",
        scope: "acme-data-pipeline",
        serviceName: "Amazon S3",
        costOfAnomaly: 692.0,
        severityLevel: "medium",
        status: "open",
        startTime: "2026-03-27T00:00:00Z",
        endTime: "2026-03-27T23:59:59Z",
    },
    {
        id: "anom-003",
        platform: "google-cloud",
        scope: "acme-analytics",
        serviceName: "BigQuery",
        costOfAnomaly: 550.0,
        severityLevel: "medium",
        status: "acknowledged",
        startTime: "2026-03-25T00:00:00Z",
        endTime: "2026-03-25T23:59:59Z",
    },
];

const DEMO_BUDGETS = [
    {
        id: "budget-001",
        budgetName: "GCP Production Budget",
        amount: 50000,
        currency: "USD",
        currentSpend: 38420.5,
        forecastedSpend: 51200.0,
        alertPercent: 80,
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        scope: { cloud: "google-cloud" },
    },
    {
        id: "budget-002",
        budgetName: "AWS Data Pipeline Budget",
        amount: 15000,
        currency: "USD",
        currentSpend: 9842.0,
        forecastedSpend: 13200.0,
        alertPercent: 90,
        startDate: "2026-03-01",
        endDate: "2026-03-31",
        scope: { cloud: "amazon-web-services" },
    },
    {
        id: "budget-003",
        budgetName: "Q1 2026 Total Cloud Budget",
        amount: 200000,
        currency: "USD",
        currentSpend: 162400.0,
        forecastedSpend: 195000.0,
        alertPercent: 85,
        startDate: "2026-01-01",
        endDate: "2026-03-31",
        scope: {},
    },
];

const DEMO_REPORTS = [
    {
        id: "report-001",
        reportName: "Monthly Cloud Cost by Service",
        type: "custom",
        owner: "demo@acme.io",
        description: "Breakdown of cloud spend grouped by service for the current month.",
        urlUI: "https://app.doit.com/analytics/report-001",
    },
    {
        id: "report-002",
        reportName: "GCP Compute Spend Trend",
        type: "custom",
        owner: "demo@acme.io",
        description: "30-day trend of GCP Compute Engine costs across all projects.",
        urlUI: "https://app.doit.com/analytics/report-002",
    },
    {
        id: "report-003",
        reportName: "Top 10 Cost Drivers",
        type: "custom",
        owner: "demo@acme.io",
        description: "Top 10 services and projects by cost in the last 30 days.",
        urlUI: "https://app.doit.com/analytics/report-003",
    },
];

const DEMO_REPORT_RESULTS = {
    "report-001": {
        reportName: "Monthly Cloud Cost by Service",
        id: "report-001",
        urlUI: "https://app.doit.com/analytics/report-001",
        result: {
            schema: [
                { name: "service", type: "string" },
                { name: "cloud", type: "string" },
                { name: "cost", type: "number" },
            ],
            rows: [
                ["Compute Engine", "google-cloud", 38420.5],
                ["Amazon EC2", "amazon-web-services", 22100.0],
                ["BigQuery", "google-cloud", 12340.0],
                ["Amazon S3", "amazon-web-services", 9842.0],
                ["Cloud SQL", "google-cloud", 7210.0],
                ["Amazon RDS", "amazon-web-services", 5620.0],
                ["Cloud Storage", "google-cloud", 3140.0],
                ["Amazon CloudFront", "amazon-web-services", 2890.0],
            ],
        },
    },
};

const DEMO_QUERY_RESULT = {
    rowCount: 6,
    columns: [
        { name: "month", type: "string" },
        { name: "cloud", type: "string" },
        { name: "cost", type: "number" },
    ],
    rows: [
        ["2025-10", "google-cloud", 58200],
        ["2025-10", "amazon-web-services", 31400],
        ["2025-11", "google-cloud", 61800],
        ["2025-11", "amazon-web-services", 33200],
        ["2025-12", "google-cloud", 64100],
        ["2025-12", "amazon-web-services", 35800],
    ],
};

const DEMO_ALERTS = [
    {
        id: "alert-001",
        name: "Monthly Spend Threshold — GCP",
        config: {
            metric: { type: "basic", value: "cost" },
            timeInterval: "month",
            value: 45000,
            currency: "USD",
            operator: "gte",
        },
        recipients: ["demo@acme.io", "finops@acme.io"],
    },
    {
        id: "alert-002",
        name: "AWS Compute Spike Alert",
        config: {
            metric: { type: "basic", value: "cost" },
            timeInterval: "day",
            value: 1000,
            currency: "USD",
            operator: "gte",
            evaluateForEach: "service",
        },
        recipients: ["demo@acme.io"],
    },
];

const DEMO_LABELS = [
    { id: "label-001", name: "Production", color: "red", type: "standard" },
    { id: "label-002", name: "Development", color: "blue", type: "standard" },
    { id: "label-003", name: "Data Platform", color: "green", type: "standard" },
    { id: "label-004", name: "Cost Optimisation", color: "yellow", type: "standard" },
];

const DEMO_ANNOTATIONS = [
    {
        id: "annot-001",
        content: "GCP contract renewal — new committed use discounts active",
        startDate: "2026-01-01",
        endDate: "2026-12-31",
        createdBy: "demo@acme.io",
    },
    {
        id: "annot-002",
        content: "AWS Reserved Instance purchase — 12-month, Compute Engine family",
        startDate: "2026-02-15",
        endDate: "2027-02-14",
        createdBy: "demo@acme.io",
    },
];

const DEMO_ALLOCATIONS = [
    {
        id: "alloc-001",
        name: "Engineering Cost Allocation",
        description: "Splits cloud costs across Engineering sub-teams by label.",
        type: "cost-allocation",
    },
    {
        id: "alloc-002",
        name: "Platform vs Product Split",
        description: "Allocates shared infrastructure costs between Platform and Product orgs.",
        type: "cost-allocation",
    },
];

const DEMO_TICKETS = [
    {
        id: "ticket-001",
        subject: "GCP quota increase request — Compute Engine CPUs",
        status: "open",
        priority: "high",
        platform: "google-cloud",
        createdAt: "2026-03-25T10:00:00Z",
        updatedAt: "2026-03-28T14:30:00Z",
    },
    {
        id: "ticket-002",
        subject: "AWS billing discrepancy — March invoice",
        status: "pending",
        priority: "medium",
        platform: "amazon-web-services",
        createdAt: "2026-03-20T09:00:00Z",
        updatedAt: "2026-03-27T11:00:00Z",
    },
    {
        id: "ticket-003",
        subject: "Cost optimisation review — Q1 2026",
        status: "closed",
        priority: "low",
        platform: "general",
        createdAt: "2026-03-01T08:00:00Z",
        updatedAt: "2026-03-15T16:00:00Z",
    },
];

const DEMO_INVOICES = [
    {
        id: "inv-2026-02",
        month: "2026-02",
        totalAmount: 95420.0,
        currency: "USD",
        status: "paid",
        issuedAt: "2026-03-01T00:00:00Z",
        dueAt: "2026-03-15T00:00:00Z",
    },
    {
        id: "inv-2026-01",
        month: "2026-01",
        totalAmount: 88200.0,
        currency: "USD",
        status: "paid",
        issuedAt: "2026-02-01T00:00:00Z",
        dueAt: "2026-02-15T00:00:00Z",
    },
    {
        id: "inv-2025-12",
        month: "2025-12",
        totalAmount: 99800.0,
        currency: "USD",
        status: "paid",
        issuedAt: "2026-01-01T00:00:00Z",
        dueAt: "2026-01-15T00:00:00Z",
    },
];

const DEMO_ASSETS = [
    { id: "asset-001", name: "acme-prod (GCP Project)", type: "google-cloud", status: "active" },
    { id: "asset-002", name: "acme-analytics (GCP Project)", type: "google-cloud", status: "active" },
    { id: "asset-003", name: "acme-data-pipeline (AWS Account)", type: "amazon-web-services", status: "active" },
    { id: "asset-004", name: "G Suite — acme.io", type: "g-suite", status: "active" },
];

const DEMO_INCIDENTS = [
    {
        id: "inc-001",
        title: "Elevated error rates on Cloud SQL — us-central1",
        platform: "google-cloud",
        product: "Cloud SQL",
        status: "resolved",
        createTime: "2026-03-26T08:00:00Z",
    },
    {
        id: "inc-002",
        title: "Increased API error rates — EC2, us-east-1",
        platform: "amazon-web-services",
        product: "Amazon EC2",
        status: "resolved",
        createTime: "2026-03-24T14:00:00Z",
    },
];

const DEMO_USERS = [
    { id: "user-001", email: "demo@acme.io", name: "Demo User", role: "Admin" },
    { id: "user-002", email: "finops@acme.io", name: "FinOps Lead", role: "Editor" },
    { id: "user-003", email: "eng-lead@acme.io", name: "Engineering Lead", role: "Viewer" },
];

const DEMO_ROLES = [
    { id: "role-001", name: "Admin", description: "Full access to all resources." },
    { id: "role-002", name: "Editor", description: "Can read and modify resources." },
    { id: "role-003", name: "Viewer", description: "Read-only access." },
    { id: "role-004", name: "FinOps", description: "Access to billing, budgets, and cost reports." },
];

const DEMO_ORGANIZATIONS = [
    { id: "org-001", name: "Acme Corp", domain: "acme.io", type: "root" },
    { id: "org-002", name: "Engineering", domain: "acme.io", type: "unit" },
    { id: "org-003", name: "Data Platform", domain: "acme.io", type: "unit" },
];

const DEMO_DIMENSIONS = [
    { id: "service", name: "Service", type: "string" },
    { id: "project_id", name: "Project", type: "string" },
    { id: "cloud", name: "Cloud Provider", type: "string" },
    { id: "region", name: "Region", type: "string" },
    { id: "label", name: "Label", type: "string" },
];

const DEMO_PLATFORMS = [
    { id: "google-cloud", name: "Google Cloud Platform" },
    { id: "amazon-web-services", name: "Amazon Web Services" },
    { id: "microsoft-azure", name: "Microsoft Azure" },
    { id: "g-suite", name: "Google Workspace" },
];

const DEMO_PRODUCTS = [
    { id: "prod-001", name: "Cloud Analytics" },
    { id: "prod-002", name: "Cost Optimization" },
    { id: "prod-003", name: "Support Center" },
    { id: "prod-004", name: "Cloud Incidents" },
];

const DEMO_DATASETS = [
    {
        id: "ds-001",
        name: "Cloud Billing Export",
        description: "Raw billing data exported from GCP.",
        status: "active",
    },
    { id: "ds-002", name: "AWS Cost & Usage Report", description: "AWS CUR data for cost analysis.", status: "active" },
];

// Cloud overview uses the same data shapes as the individual tools so the
// widget renders the same columns regardless of which tool produced the data.
const DEMO_CLOUD_OVERVIEW = {
    costByCloud: {
        columns: [{ name: "cloud_provider" }, { name: "cost" }],
        rows: [
            ["google-cloud", 62400],
            ["amazon-web-services", 38200],
        ],
    },
    topServices: {
        columns: [{ name: "cloud_provider" }, { name: "service_description" }, { name: "cost" }],
        rows: [
            ["google-cloud", "Compute Engine", 38420],
            ["google-cloud", "BigQuery", 12340],
            ["google-cloud", "Cloud SQL", 7210],
            ["amazon-web-services", "Amazon EC2", 22100],
            ["amazon-web-services", "Amazon S3", 9842],
            ["amazon-web-services", "Amazon RDS", 5620],
        ],
    },
    topProjects: {
        columns: [{ name: "cloud_provider" }, { name: "project_id" }, { name: "cost" }],
        rows: [
            ["google-cloud", "acme-prod", 38420],
            ["google-cloud", "acme-analytics", 12340],
            ["amazon-web-services", "acme-data-pipeline", 22100],
        ],
    },
    anomalies: DEMO_ANOMALIES.slice(0, 3),
    incidents: DEMO_INCIDENTS.slice(0, 2),
};

// ── router ─────────────────────────────────────────────────────────────────────

/**
 * Returns canned demo data for the given URL + method, or null if no match.
 * Matches on the URL pathname, stripping query parameters first.
 */
export function getDemoResponse(url: string, method: string, body?: any): unknown | null {
    const path = pathOf(url);
    const GET = method === "GET";
    const POST = method === "POST";

    // validate user
    if (path.includes("/auth/v1/validate")) {
        return { email: DEMO_USER.email, domain: DEMO_USER.domain };
    }

    // POST /analytics/v1/reports/query — used by both cloud overview (internal)
    // and run_query (standalone). Differentiate by group dimensions in body.
    if (path.includes("/analytics/v1/reports/query") && POST) {
        const groups: string[] = (body?.config?.group ?? []).map((g: any) => g.id);
        if (groups.includes("project_id")) {
            return {
                result: { schema: DEMO_CLOUD_OVERVIEW.topProjects.columns, rows: DEMO_CLOUD_OVERVIEW.topProjects.rows },
            };
        }
        if (groups.includes("service_description")) {
            return {
                result: { schema: DEMO_CLOUD_OVERVIEW.topServices.columns, rows: DEMO_CLOUD_OVERVIEW.topServices.rows },
            };
        }
        if (groups.includes("cloud_provider") && groups.length === 1) {
            return {
                result: { schema: DEMO_CLOUD_OVERVIEW.costByCloud.columns, rows: DEMO_CLOUD_OVERVIEW.costByCloud.rows },
            };
        }
        // Standalone run_query fallback — return generic time-series data
        return { result: { schema: DEMO_QUERY_RESULT.columns, rows: DEMO_QUERY_RESULT.rows } };
    }

    // reports — individual (must be before list check)
    if (path.match(/\/analytics\/v1\/reports\/[^/]+\/results/)) {
        const id = path.split("/")[5]; // /analytics/v1/reports/<id>/results
        const result = DEMO_REPORT_RESULTS[id as keyof typeof DEMO_REPORT_RESULTS] ?? DEMO_REPORT_RESULTS["report-001"];
        return result;
    }
    if (path.match(/\/analytics\/v1\/reports\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_REPORTS.find((r) => r.id === id) ?? DEMO_REPORTS[0];
    }
    // reports — list
    if (path.includes("/analytics/v1/reports") && GET) {
        return { rowCount: DEMO_REPORTS.length, reports: DEMO_REPORTS };
    }

    // anomalies — individual
    if (path.match(/\/anomalies\/v1\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_ANOMALIES.find((a) => a.id === id) ?? DEMO_ANOMALIES[0];
    }
    // anomalies — list / run_query
    if (path.includes("/anomalies/v1")) {
        return { rowCount: DEMO_ANOMALIES.length, anomalies: DEMO_ANOMALIES };
    }

    // budgets — individual
    if (path.match(/\/analytics\/v1\/budgets\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_BUDGETS.find((b) => b.id === id) ?? DEMO_BUDGETS[0];
    }
    if (path.includes("/analytics/v1/budgets") && (POST || method === "PATCH")) {
        return { ...DEMO_BUDGETS[0], id: "budget-new" };
    }
    // budgets — list
    if (path.includes("/analytics/v1/budgets")) {
        return { rowCount: DEMO_BUDGETS.length, budgets: DEMO_BUDGETS };
    }

    // alerts — individual
    if (path.match(/\/analytics\/v1\/alerts\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_ALERTS.find((a) => a.id === id) ?? DEMO_ALERTS[0];
    }
    if (path.includes("/analytics/v1/alerts") && (POST || method === "PATCH")) {
        return { ...DEMO_ALERTS[0], id: "alert-new" };
    }
    // alerts — list
    if (path.includes("/analytics/v1/alerts")) {
        return { rowCount: DEMO_ALERTS.length, alerts: DEMO_ALERTS };
    }

    // labels — assignments
    if (path.match(/\/analytics\/v1\/labels\/[^/]+\/assignments/)) {
        return { assignments: [{ objectId: "asset-001", objectType: "gcp-project" }] };
    }
    // labels — individual
    if (path.match(/\/analytics\/v1\/labels\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_LABELS.find((l) => l.id === id) ?? DEMO_LABELS[0];
    }
    if (path.includes("/analytics/v1/labels") && (POST || method === "PATCH")) {
        return { ...DEMO_LABELS[0], id: "label-new" };
    }
    // labels — list
    if (path.includes("/analytics/v1/labels")) {
        return { rowCount: DEMO_LABELS.length, labels: DEMO_LABELS };
    }

    // annotations — individual
    if (path.match(/\/analytics\/v1\/annotations\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_ANNOTATIONS.find((a) => a.id === id) ?? DEMO_ANNOTATIONS[0];
    }
    if (path.includes("/analytics/v1/annotations") && (POST || method === "PATCH")) {
        return { ...DEMO_ANNOTATIONS[0], id: "annot-new" };
    }
    // annotations — list
    if (path.includes("/analytics/v1/annotations")) {
        return { rowCount: DEMO_ANNOTATIONS.length, annotations: DEMO_ANNOTATIONS };
    }

    // allocations — individual
    if (path.match(/\/analytics\/v1\/allocations\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_ALLOCATIONS.find((a) => a.id === id) ?? DEMO_ALLOCATIONS[0];
    }
    if (path.includes("/analytics/v1/allocations") && (POST || method === "PATCH")) {
        return { ...DEMO_ALLOCATIONS[0], id: "alloc-new" };
    }
    // allocations — list
    if (path.includes("/analytics/v1/allocations")) {
        return { rowCount: DEMO_ALLOCATIONS.length, allocations: DEMO_ALLOCATIONS };
    }

    // dimensions — single dimension (must precede /dimensions list)
    if (path.includes("/analytics/v1/dimension/") && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_DIMENSIONS.find((d) => d.id === id) ?? DEMO_DIMENSIONS[0];
    }
    // dimensions — list
    if (path.includes("/analytics/v1/dimensions") && GET) {
        return { rowCount: DEMO_DIMENSIONS.length, dimensions: DEMO_DIMENSIONS };
    }

    // invoices — individual
    if (path.match(/\/billing\/v1\/invoices\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_INVOICES.find((i) => i.id === id) ?? DEMO_INVOICES[0];
    }
    // invoices — list
    if (path.includes("/billing/v1/invoices")) {
        return { rowCount: DEMO_INVOICES.length, invoices: DEMO_INVOICES };
    }

    // assets — individual
    if (path.match(/\/billing\/v1\/assets\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_ASSETS.find((a) => a.id === id) ?? DEMO_ASSETS[0];
    }
    // assets — list
    if (path.includes("/billing/v1/assets")) {
        return { rowCount: DEMO_ASSETS.length, assets: DEMO_ASSETS };
    }

    // tickets — individual
    if (path.match(/\/support\/v1\/tickets\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_TICKETS.find((t) => t.id === id) ?? DEMO_TICKETS[0];
    }
    // tickets — list / create
    if (path.includes("/support/v1/tickets")) {
        if (POST) return { ...DEMO_TICKETS[0], id: "ticket-new", subject: "New demo ticket" };
        return { rowCount: DEMO_TICKETS.length, tickets: DEMO_TICKETS };
    }

    // cloud incidents — individual
    if (path.match(/\/core\/v1\/cloudincidents\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_INCIDENTS.find((i) => i.id === id) ?? DEMO_INCIDENTS[0];
    }
    // cloud incidents — list
    if (path.includes("/core/v1/cloudincidents")) {
        return { rowCount: DEMO_INCIDENTS.length, incidents: DEMO_INCIDENTS };
    }

    // users
    if (path.includes("/iam/v1/users")) {
        return { rowCount: DEMO_USERS.length, users: DEMO_USERS };
    }

    // roles
    if (path.includes("/iam/v1/roles")) {
        return { rowCount: DEMO_ROLES.length, roles: DEMO_ROLES };
    }

    // organizations
    if (path.includes("/iam/v1/organizations")) {
        return { rowCount: DEMO_ORGANIZATIONS.length, organizations: DEMO_ORGANIZATIONS };
    }

    // platforms
    if (path.includes("/support/v1/metadata/platforms")) {
        return { rowCount: DEMO_PLATFORMS.length, platforms: DEMO_PLATFORMS };
    }

    // products
    if (path.includes("/support/v1/metadata/products")) {
        return { rowCount: DEMO_PRODUCTS.length, products: DEMO_PRODUCTS };
    }

    // datahub datasets — individual
    if (path.match(/\/datahub\/v1\/datasets\/[^/]+$/) && GET) {
        const id = path.split("/").pop() ?? "";
        return DEMO_DATASETS.find((d) => d.id === id) ?? DEMO_DATASETS[0];
    }
    // datahub datasets — list
    if (path.includes("/datahub/v1/datasets")) {
        return { rowCount: DEMO_DATASETS.length, datasets: DEMO_DATASETS };
    }

    // cloud diagrams
    if (path.includes("/clouddiagrams/v1/scheme/find")) {
        return { rowCount: 0, diagrams: [] };
    }

    // cloudflow trigger
    if (path.includes("/cloudflow/v1/trigger") && POST) {
        return { status: "triggered", message: "Demo CloudFlow triggered successfully." };
    }

    return null;
}

export const DEMO_TOKEN = "demo_key";
