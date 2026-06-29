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

export const cloudDiagramExportFixture = {
    statussheet: {
        _id: "layer-1",
        name: "Production",
    },
    metadata: {
        user: "alice@example.com",
        date: "2026-06-29T00:00:00Z",
        version: "3",
    },
    nodes: [{ _id: "node-1", name: "EC2", cld_type: "AWS" }],
    elements: [],
    groups: [{ _id: "group-1", name: "VPC" }],
    attachments: [],
    links: [],
    combiners: [],
    notes: [],
};

export const cloudDiagramLayerComponentsFixture = {
    node: {
        "node-1": {
            _id: "node-1",
            name: "EC2",
            cld_type: "AWS",
            cld_account: "123456789012",
            running: true,
        },
    },
    element: {
        "element-1": {
            _id: "element-1",
            name: "Internet Gateway",
            cld_type: "AWS",
        },
    },
};
