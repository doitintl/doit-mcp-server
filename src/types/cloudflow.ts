export type CloudFlowCustomRole = {
    roleId?: string;
    permissions?: string[];
};

export type CloudFlowGcpConfig = {
    organizationId?: string;
    folderId?: string;
    projectId?: string;
    level?: "organization" | "folder" | "project";
    serviceAccountName?: string;
    predefinedRoles?: string[];
    customRole?: CloudFlowCustomRole;
    infraManagerProject?: string;
    infraManagerLocation?: string;
    infraManagerServiceAccount?: string;
    status?: string;
    deploymentCommand?: string;
};

export type CloudFlowAwsContext = {
    accountId?: string;
    regions?: string[];
    status?: string;
};

export type CloudFlowAwsConfig = {
    context?: CloudFlowAwsContext[];
    roleName?: string;
    permissions?: Record<string, unknown>;
    managementAccount?: string;
    organizationRootId?: string;
    scopeTargetedOrganizationalUnitIds?: string[];
    scopeExplicitAccountIds?: string[];
    scopeExcludedAccountIds?: string[];
    scopeManagementAccountExplicitInScope?: boolean;
};

export type CloudFlowCollaborator = {
    email?: string;
    role?: "owner" | "editor" | "user";
};

export type CloudFlowConnection = {
    connectionId: string;
    name?: string;
    description?: string;
    gcpConfig?: CloudFlowGcpConfig;
    awsConfig?: CloudFlowAwsConfig;
    collaborators?: CloudFlowCollaborator[];
    enabled?: boolean;
    status?: string;
    createdAt?: string;
    updatedAt?: string;
};

export type CloudFlowConnectionsResponse = {
    connections: CloudFlowConnection[];
    nextPageToken?: string;
};
