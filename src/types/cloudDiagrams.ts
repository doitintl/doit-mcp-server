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

/**
 * Response of GET /clouddiagrams/v1/statussheet/{id}/export-json
 * (Export diagram as JSON). The statussheet object is free-form; the
 * component arrays mirror the diagram's nodes, elements, groups, etc.
 */
export type ExportCloudDiagramJsonResponse = {
    statussheet?: Record<string, unknown>;
    metadata?: {
        user: string;
        date: string;
        version: string;
        connections?: Record<string, string>;
    };
    nodes?: Record<string, unknown>[];
    elements?: Record<string, unknown>[];
    groups?: Record<string, unknown>[];
    attachments?: Record<string, unknown>[];
    links?: Record<string, unknown>[];
    combiners?: Record<string, unknown>[];
    notes?: Record<string, unknown>[];
};

/**
 * Response of POST /clouddiagrams/v1/statussheet/{id}/get
 * (Get layer components). Each component type maps component IDs to their
 * component document.
 */
export type GetCloudDiagramLayerComponentsResponse = {
    node?: Record<string, Record<string, unknown>>;
    element?: Record<string, Record<string, unknown>>;
    group?: Record<string, Record<string, unknown>>;
    link?: Record<string, Record<string, unknown>>;
    attachment?: Record<string, Record<string, unknown>>;
    combiner?: Record<string, Record<string, unknown>>;
    note?: Record<string, Record<string, unknown>>;
};
