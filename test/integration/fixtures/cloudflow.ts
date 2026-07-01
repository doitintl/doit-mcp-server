export const cloudflowTriggerFixture = {
    status: "triggered",
    executionId: "exec-123",
};

export const cloudflowConnectionFixture = {
    connectionId: "conn-1",
    name: "GCP Org Connection",
    description: "Organization-level GCP connection",
    gcpConfig: {
        organizationId: "123456789",
        level: "organization",
        serviceAccountName: "doit-connect@example.iam.gserviceaccount.com",
        predefinedRoles: ["roles/viewer"],
        status: "healthy",
    },
    collaborators: [{ email: "owner@example.com", role: "owner" }],
    enabled: true,
    status: "active",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-02-01T00:00:00Z",
};

export const cloudflowConnectionsFixture = {
    connections: [
        cloudflowConnectionFixture,
        {
            connectionId: "conn-2",
            name: "AWS Management Connection",
            awsConfig: {
                roleName: "doit-connect-role",
                managementAccount: "111122223333",
                context: [{ accountId: "111122223333", regions: ["us-east-1"], status: "healthy" }],
            },
            enabled: true,
            status: "active",
        },
    ],
    nextPageToken: "next-page-token",
};
