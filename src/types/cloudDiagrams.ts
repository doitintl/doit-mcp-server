export type CloudDiagram = {
    diagramUrl: string;
    imageUrl: string;
};

export type FindCloudDiagramsResponse = CloudDiagram[];

// Get diagrams with stats — GET /clouddiagrams/v1/scheme/stats
export type CloudDiagramStatsChange = {
    type: "NODE_CREATE" | "NODE_UPDATE" | "NODE_DELETE";
    service: string;
    count: number;
};

export type CloudDiagramImportState = {
    status: "queued" | "in_progress" | "success" | "failure";
    type: "AWS" | "GCP" | "AZURE";
    account: string;
    cloudId: string;
    errorMessage?: string;
    syncedAt?: string;
};

export type CloudDiagramStats = {
    _id: string;
    ss_id: string;
    name: string;
    type: "application" | "infrastructure" | "network" | "template";
    account_name?: string;
    account_id?: string;
    account_type?: string;
    changes?: CloudDiagramStatsChange[];
    import?: CloudDiagramImportState;
};

export type GetCloudDiagramsStatsResponse = CloudDiagramStats[];

// Search diagrams and components — POST /clouddiagrams/v1/scheme/search
export type CloudDiagramSchemeSearchItem = {
    _id: string;
    type: string;
    account_name?: string;
    scheme_id?: string;
    ss_id?: string;
    scheme?: string;
    status?: string;
    name?: string;
};

export type CloudDiagramComponentSearchItem = {
    _id: string;
    type: string;
    account_name?: string;
    icon?: string;
    color?: string;
    scheme_id?: string;
    ss_id?: string;
    name?: string;
    node_type?: string;
    group_type?: string;
    props?: {
        service_type?: string;
        [key: string]: unknown;
    };
};

export type SearchCloudDiagramsResponse = {
    scheme?: CloudDiagramSchemeSearchItem[];
    component?: CloudDiagramComponentSearchItem[];
    prop?: CloudDiagramComponentSearchItem[];
};

// List activity groups for a layer — GET /clouddiagrams/v1/activity
export type CloudDiagramActivityType =
    | "NODE_CREATE"
    | "NODE_UPDATE"
    | "NODE_DELETE"
    | "LINK_CREATE"
    | "LINK_UPDATE"
    | "LINK_DELETE"
    | "GROUP_CREATE"
    | "GROUP_UPDATE"
    | "GROUP_DELETE"
    | "ATTACHMENT_CREATE"
    | "ATTACHMENT_UPDATE"
    | "ATTACHMENT_DELETE";

export type CloudDiagramActivityItem = {
    _id: string;
    group: string;
    activity: CloudDiagramActivityType;
    metadata?: Record<string, unknown>;
    timestamp: string;
    service_type?: string;
    group_type?: string;
    tags?: string[];
};

export type CloudDiagramSnapshotActivityGroup = {
    _id: string;
    statussheet: string;
    timestamp: string;
    tags?: string[];
    snapshot: string;
    items: CloudDiagramActivityItem[];
};

export type ListCloudDiagramActivityGroupsResponse = CloudDiagramSnapshotActivityGroup[];

// List node activities — GET /clouddiagrams/v1/activity/node-activities
export type CloudDiagramNodeActivity = {
    _id: string;
    activity: "NODE_CREATE" | "NODE_UPDATE" | "NODE_DELETE";
    metadata?: Record<string, unknown>;
    timestamp: string;
    user: string;
    statussheet: string;
};

export type ListCloudDiagramNodeActivitiesResponse = CloudDiagramNodeActivity[];
