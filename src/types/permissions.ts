export type ResourcePermissionRole = "owner" | "editor" | "viewer";

export type ResourcePermissionEntry = {
    user: string;
    role: ResourcePermissionRole;
};

export type ResourcePermissionsResponse = {
    id: string;
    name?: string;
    description?: string;
    createTime?: number;
    updateTime?: number;
    permissions: ResourcePermissionEntry[];
    public?: "editor" | "viewer" | null;
};
