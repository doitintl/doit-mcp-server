export const reportsFixture = {
    pageToken: "",
    rowCount: 2,
    reports: [
        {
            id: "report-1",
            reportName: "Monthly Cost Report",
            owner: "alice@example.com",
            type: "billing",
            createTime: 1700000000000,
            updateTime: 1700100000000,
            urlUI: "https://console.doit.com/reports/report-1",
        },
        {
            id: "report-2",
            reportName: "Monthly Cost Report",
            owner: "bob@example.com",
            type: "custom",
            createTime: 0,
            updateTime: 0,
            urlUI: "https://console.doit.com/reports/report-2",
            labels: [
                {
                    id: "project_name",
                    name: "my-project",
                },
            ],
        },
    ],
};

export const queryResultFixture = {
    result: {
        schema: [
            { name: "service_description", type: "string" },
            { name: "cost", type: "number" },
        ],
        rows: [
            ["Compute Engine", 1234.56],
            ["Cloud Storage", 567.89],
        ],
        cacheHit: false,
    },
};

export const reportResultsFixture = {
    id: "report-1",
    reportName: "Monthly Cost Report",
    owner: "alice@example.com",
    type: "billing",
    createTime: 1700000000000,
    updateTime: 1700100000000,
    urlUI: "https://console.doit.com/reports/report-1",
    result: {
        schema: [
            { name: "service_description", type: "string" },
            { name: "cost", type: "number" },
        ],
        rows: [
            ["Compute Engine", 1234.56],
            ["Cloud Storage", 567.89],
        ],
    },
};

export const dimensionsFixture = {
    pageToken: "",
    rowCount: 2,
    dimensions: [
        { id: "service_description", label: "Service", type: "fixed" },
        { id: "project_name", label: "Project", type: "fixed" },
    ],
};

export const dimensionFixture = {
    id: "service_description",
    label: "Service",
    type: "fixed",
    values: [{ value: "Compute Engine" }, { value: "Cloud Storage" }],
};

export const allocationsFixture = {
    allocations: [
        {
            id: "alloc-1",
            name: "Engineering",
            owner: "alice@example.com",
            type: "custom",
            allocationType: "single" as const,
            createTime: 1700000000000,
            updateTime: 1700100000000,
            urlUI: "https://console.doit.com/allocations/alloc-1",
        },
    ],
};

export const allocationFixture = {
    id: "alloc-1",
    name: "Engineering",
    description: "Engineering team costs",
    type: "custom",
    allocationType: "single" as const,
    createTime: 1700000000000,
    updateTime: 1700100000000,
    anomalyDetection: true,
    rule: {
        components: [
            {
                key: "project_name",
                type: "fixed",
                values: ["my-project"],
                inverse_selection: false,
                include_null: false,
                mode: "is",
            },
        ],
        formula: "A",
    },
};

export const createAllocationFixture = {
    id: "alloc-new",
    type: "custom",
};

export const updateAllocationFixture = {
    id: "alloc-1",
    type: "custom",
};

export const alertsFixture = {
    rowCount: 1,
    alerts: [
        {
            id: "alert-1",
            name: "Cost Spike Alert",
            createTime: 1700000000000,
            updateTime: 1700100000000,
            lastAlerted: 1700200000000,
            recipients: ["alice@example.com"],
            config: {
                condition: "value",
                currency: "USD",
                metric: { type: "basic", value: "cost" },
                operator: "gt",
                evaluateForEach: "",
                scopes: [{ id: "project_name", type: "fixed", mode: "is", values: ["my-project"] }],
                timeInterval: "month",
                dataSource: "billing",
                value: 1000,
            },
        },
    ],
};

export const labelFixture = {
    id: "label-1",
    name: "Engineering",
    color: "blue",
    type: "custom",
    createTime: "2026-01-01T00:00:00.000Z",
    updateTime: "2026-01-02T00:00:00.000Z",
};

export const labelsFixture = {
    pageToken: "",
    rowCount: 2,
    labels: [
        {
            id: "label-1",
            name: "Engineering",
            color: "blue",
            type: "custom",
            createTime: "2026-01-01T00:00:00.000Z",
            updateTime: "2026-01-02T00:00:00.000Z",
        },
        {
            id: "label-2",
            name: "Finance",
            color: "teal",
            type: "preset",
            createTime: "2026-02-01T00:00:00.000Z",
            updateTime: "2026-02-02T00:00:00.000Z",
        },
    ],
};

export const budgetsFixture = {
    budgets: [
        {
            alertThresholds: [{ amount: 0, percentage: 80 }],
            amount: 1000,
            budgetName: "Monthly Budget",
            createTime: 1700000000000,
            currency: "USD",
            currentUtilization: 50,
            endPeriod: 1700100000000,
            id: "budget-1",
            owner: "alice@example.com",
            scopes: [
                {
                    id: "cloud_provider",
                    type: "fixed",
                    inverse: false,
                    mode: "is",
                    values: ["google-cloud"],
                },
            ],
            startPeriod: 1700000000000,
            timeInterval: "month",
            updateTime: 1700050000000,
            url: "https://console.doit.com/budgets/budget-1",
        },
    ],
    pageToken: "",
    rowCount: 1,
};

export const budgetFixture = {
    alerts: [{ forecastedDate: 1700090000000, percentage: 80, triggered: true }],
    amount: 1000,
    seasonalAmounts: [],
    collaborators: [{ email: "alice@example.com", role: "owner" }],
    createTime: 1700000000000,
    currency: "USD",
    currentUtilization: 50,
    description: "Monthly cloud budget",
    endPeriod: 1700100000000,
    forecastedUtilization: 75,
    growthPerPeriod: 0,
    id: "budget-1",
    metric: "cost",
    name: "Monthly Budget",
    public: "owner",
    recipients: ["alice@example.com"],
    recipientsSlackChannels: [],
    scope: [],
    scopes: [{ id: "cloud_provider", type: "fixed", inverse: false, mode: "is", values: ["google-cloud"] }],
    startPeriod: 1700000000000,
    timeInterval: "month",
    type: "recurring",
    updateTime: 1700050000000,
    usePrevSpend: false,
};

export const createBudgetFixture = {
    id: "budget-new-1",
    name: "Test Budget",
    amount: 500,
    currency: "USD",
    type: "recurring",
    timeInterval: "month",
    startPeriod: 1704067200000,
    createTime: 1704067200000,
    metric: "cost",
    usePrevSpend: false,
    scopes: [
        {
            id: "cloud_provider",
            type: "fixed",
            mode: "is",
            values: ["amazon-web-services"],
        },
    ],
    collaborators: [{ role: "owner", email: "test@example.com" }],
};

export const createAlertFixture = {
    id: "alert-new-1",
    name: "New Alert",
    createTime: 1700000000000,
    updateTime: 1700000000000,
    lastAlerted: null,
    recipients: ["user@example.com"],
    config: {
        condition: "value",
        currency: "USD",
        metric: { type: "basic", value: "cost" },
        operator: "gt",
        evaluateForEach: "",
        scopes: [{ id: "project_name", type: "fixed", mode: "is", values: ["my-project"] }],
        timeInterval: "month",
        dataSource: "billing",
        value: 500,
    },
};

export const updateBudgetFixture = {
    id: "budget-1",
    name: "Updated Budget",
    amount: 2000,
    currency: "USD",
    type: "recurring",
    timeInterval: "month",
    startPeriod: 1700000000000,
    createTime: 1700000000000,
    updateTime: 1704153600000,
    metric: "cost",
    usePrevSpend: false,
    scopes: [{ id: "cloud_provider", type: "fixed", mode: "is", values: ["google-cloud"] }],
    collaborators: [{ role: "owner", email: "alice@example.com" }],
};

export const alertFixture = {
    id: "alert-1",
    name: "Cost Spike Alert",
    createTime: 1700000000000,
    updateTime: 1700100000000,
    lastAlerted: 1700200000000,
    recipients: ["alice@example.com"],
    config: {
        condition: "value",
        currency: "USD",
        metric: { type: "basic", value: "cost" },
        operator: "gt",
        evaluateForEach: "",
        scopes: [{ id: "project_name", type: "fixed", mode: "is", values: ["my-project"] }],
        timeInterval: "month",
        dataSource: "billing",
        value: 1000,
    },
};

export const reportConfigFixture = {
    id: "report-1",
    name: "Monthly Cost Report",
    type: "custom",
    config: {
        dataSource: "billing",
        metrics: [{ type: "basic", value: "cost" }],
        timeRange: { mode: "last", amount: 1, unit: "month", includeCurrent: true },
        group: [{ id: "service_description", type: "fixed" }],
        layout: "table",
        currency: "USD",
    },
};

export const createReportFixture = {
    id: "report-new-1",
    name: "My New Report",
    description: "A test report",
    type: "custom",
    config: { dataSource: "billing" },
    labels: [],
};

export const updateReportFixture = {
    id: "report-1",
    name: "Updated Report",
    description: "An update via API",
    type: "custom",
    config: { dataSource: "billing" },
    labels: [],
};

export const annotationFixture = {
    id: "annotation-1",
    content: "Budget threshold reached",
    timestamp: "2026-01-15T00:00:00.000Z",
    reports: ["report-1"],
    labels: [{ id: "label-1", name: "Engineering" }],
    createTime: "2026-01-01T00:00:00.000Z",
    updateTime: "2026-01-02T00:00:00.000Z",
};

export const annotationsFixture = {
    pageToken: "",
    rowCount: 2,
    annotations: [
        {
            id: "annotation-1",
            content: "Budget threshold reached",
            timestamp: "2026-01-15T00:00:00.000Z",
            reports: ["report-1"],
            labels: [{ id: "label-1", name: "Engineering" }],
            createTime: "2026-01-01T00:00:00.000Z",
            updateTime: "2026-01-02T00:00:00.000Z",
        },
        {
            id: "annotation-2",
            content: "Cost anomaly detected",
            timestamp: "2026-02-01T00:00:00.000Z",
            labels: [],
            createTime: "2026-02-01T00:00:00.000Z",
            updateTime: "2026-02-02T00:00:00.000Z",
        },
    ],
};

export const createAnnotationFixture = {
    id: "annotation-new",
    content: "New annotation content",
    timestamp: "2026-03-01T00:00:00.000Z",
    reports: ["report-1"],
    labels: [{ id: "label-1", name: "Engineering" }],
    createTime: "2026-03-01T00:00:00.000Z",
    updateTime: "2026-03-01T00:00:00.000Z",
};

export const updateAnnotationFixture = {
    id: "annotation-1",
    content: "Updated annotation content",
    timestamp: "2026-01-15T00:00:00.000Z",
    reports: ["report-1"],
    labels: [{ id: "label-1", name: "Engineering" }],
    createTime: "2026-01-01T00:00:00.000Z",
    updateTime: "2026-03-01T00:00:00.000Z",
};

export const createLabelFixture = {
    id: "label-new",
    name: "New Label",
    color: "teal",
    type: "custom",
    createTime: "2026-03-01T00:00:00.000Z",
    updateTime: "2026-03-01T00:00:00.000Z",
};

export const updateLabelFixture = {
    id: "label-1",
    name: "Updated Engineering",
    color: "purple",
    type: "custom",
    createTime: "2026-01-01T00:00:00.000Z",
    updateTime: "2026-03-01T00:00:00.000Z",
};

export const labelAssignmentsFixture = {
    assignments: [
        { objectId: "report-1", objectType: "report" },
        { objectId: "budget-1", objectType: "budget" },
    ],
};

export const updateAlertFixture = {
    id: "alert-1",
    name: "Updated Alert",
    createTime: 1700000000000,
    updateTime: 1700200000000,
    lastAlerted: null,
    recipients: ["updated@example.com"],
    config: {
        condition: "value",
        currency: "USD",
        metric: { type: "basic", value: "cost" },
        operator: "gt",
        evaluateForEach: "",
        scopes: [{ id: "project_name", type: "fixed", mode: "is", values: ["my-project"] }],
        timeInterval: "month",
        dataSource: "billing",
        value: 2000,
    },
};

export const commitmentsFixture = {
    pageToken: "",
    rowCount: 1,
    commitments: [
        {
            id: "commitment-1",
            name: "GCP 3-Year CUD",
            startDate: "2025-01-01T00:00:00.000Z",
            endDate: "2028-01-01T00:00:00.000Z",
            currency: "USD",
            cloudProvider: "google-cloud",
            totalCommitmentValue: 100000,
            totalCurrentAttainment: 75000,
            periods: [
                {
                    startDate: "2025-01-01T00:00:00.000Z",
                    endDate: "2026-01-01T00:00:00.000Z",
                    commitmentValue: 33333,
                    marketplaceLimitPercentage: 25,
                },
            ],
            createTime: 1735689600000,
            updateTime: 1750032000000,
        },
    ],
};

export const commitmentFixture = {
    id: "commitment-1",
    name: "GCP 3-Year CUD",
    startDate: "2025-01-01T00:00:00.000Z",
    endDate: "2028-01-01T00:00:00.000Z",
    currency: "USD",
    cloudProvider: "google-cloud",
    totalCommitmentValue: 100000,
    totalCurrentAttainment: 75000,
    periods: [
        {
            startDate: "2025-01-01T00:00:00.000Z",
            endDate: "2026-01-01T00:00:00.000Z",
            commitmentValue: 33333,
            marketplaceLimitPercentage: 25,
        },
    ],
    createTime: "2025-01-01T00:00:00.000Z",
    updateTime: "2025-06-15T00:00:00.000Z",
};
