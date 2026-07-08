export const cloudDiagramsFixture = [
    {
        diagramUrl: "https://console.doit.com/cloud-diagrams/diagram/scheme-1/sheet-1/cust-1",
        imageUrl: "https://console.doit.com/cloud-diagrams/image/scheme-1/sheet-1",
    },
    {
        diagramUrl: "https://console.doit.com/cloud-diagrams/diagram/scheme-2/sheet-2/cust-1",
        imageUrl: "https://console.doit.com/cloud-diagrams/image/scheme-2/sheet-2",
    },
];

export const cloudDiagramsStatsFixture = [
    {
        _id: "scheme-1",
        ss_id: "sheet-1",
        name: "Production VPC",
        type: "infrastructure",
        account_name: "prod-account",
        account_id: "123456789012",
        account_type: "AWS",
        changes: [
            { type: "NODE_CREATE", service: "EC2", count: 3 },
            { type: "NODE_UPDATE", service: "RDS", count: 1 },
        ],
        import: {
            status: "success",
            type: "AWS",
            account: "conn-1",
            cloudId: "123456789012",
            syncedAt: "2026-04-28T00:00:00Z",
        },
    },
];

export const cloudDiagramActivityGroupsFixture = [
    {
        _id: "group-1",
        statussheet: "sheet-1",
        timestamp: "2026-04-28T12:00:00Z",
        tags: ["sync"],
        snapshot: "snap-1",
        items: [
            {
                _id: "item-1",
                group: "group-1",
                activity: "NODE_CREATE",
                metadata: { nodeId: "node-1" },
                timestamp: "2026-04-28T12:00:00Z",
                service_type: "AWS::EC2::Instance",
            },
            {
                _id: "item-2",
                group: "group-1",
                activity: "LINK_CREATE",
                metadata: { linkId: "link-1" },
                timestamp: "2026-04-28T12:00:01Z",
            },
        ],
    },
];

export const cloudDiagramNodeActivitiesFixture = [
    {
        _id: "act-1",
        activity: "NODE_UPDATE",
        metadata: { field: "name", from: "old", to: "web-server" },
        timestamp: "2026-04-28T12:05:00Z",
        user: "alice@example.com",
        statussheet: "sheet-1",
    },
    {
        _id: "act-2",
        activity: "NODE_CREATE",
        metadata: { nodeId: "node-1" },
        timestamp: "2026-04-28T12:00:00Z",
        user: "alice@example.com",
        statussheet: "sheet-1",
    },
];

export const cloudDiagramsSearchFixture = {
    scheme: [
        {
            _id: "sheet-1",
            type: "statussheet",
            account_name: "prod-account",
            scheme_id: "scheme-1",
            ss_id: "sheet-1",
            scheme: "Production",
            status: "success",
            name: "Production",
        },
    ],
    component: [
        {
            _id: "node-1",
            type: "node",
            account_name: "prod-account",
            scheme_id: "scheme-1",
            ss_id: "sheet-1",
            name: "web-server",
            node_type: "host",
            props: { service_type: "AWS::EC2::Instance" },
        },
    ],
    prop: [],
};

export const cloudDiagramCostSnapshotFixture = {
    diagramId: "sheet-1",
    currency: "USD",
    timeRange: { startDate: "2026-04-01", endDate: "2026-04-30", interval: "day" },
    total: 1234.56,
    trendingPct: 12.5,
    topResources: [
        { id: "node-1", name: "web-server", type: "AWS::EC2::Instance", amount: 500.25 },
        { id: "node-2", name: "db", type: "AWS::RDS::DBInstance", amount: 320.1 },
    ],
    byService: [
        { service: "EC2", amount: 800.35 },
        { service: "RDS", amount: 320.1 },
    ],
    trend: [
        { bucketStart: "2026-04-01", amount: 40.12 },
        { bucketStart: "2026-04-02", amount: 41.0 },
    ],
};

export const cloudDiagramComponentsFixture = [
    {
        _id: "scheme-1",
        name: "Production VPC",
        type: "infrastructure",
        account_name: "prod-account",
        statussheet: {
            "sheet-1": { _id: "sheet-1", account_name: "prod-account" },
            "sheet-2": { _id: "sheet-2", account_name: "staging-account" },
        },
    },
    {
        _id: "scheme-2",
        name: "Dev Environment",
        type: "application",
        account_name: "dev-account",
        statussheet: {
            "sheet-3": { _id: "sheet-3", account_name: "dev-account" },
        },
    },
];

export const cloudDiagramResourceRelationshipsFixture = {
    anchor: { id: "node-1", type: "node", name: "web-server", serviceType: "AWS::EC2::Instance" },
    direction: "both",
    depth: "direct",
    kind: "edges",
    relations: [
        {
            id: "node-2",
            type: "node",
            name: "db",
            serviceType: "AWS::RDS::DBInstance",
            relation: "downstream",
            hops: 1,
        },
        {
            id: "node-3",
            type: "node",
            name: "load-balancer",
            serviceType: "AWS::ElasticLoadBalancingV2::LoadBalancer",
            relation: "upstream",
            hops: 1,
        },
    ],
    truncated: false,
};
