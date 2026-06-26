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

export const cloudDiagramLayerSnapshotsFixture = [
    {
        _id: "snap-2",
        name: "After EC2 add",
        created_at: "2026-04-28T10:00:00Z",
        prev_state: "snap-1",
    },
    {
        _id: "snap-1",
        name: "Initial",
        created_at: "2026-04-27T10:00:00Z",
        prev_state: "",
    },
];

export const cloudDiagramLayerSnapshotFixture = {
    _id: "snap-1",
    name: "Initial",
    created_at: "2026-04-27T10:00:00Z",
    prev_state: "",
};

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
