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
