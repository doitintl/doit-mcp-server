export const organizationsFixture = {
    organizations: [
        { id: "org-1", name: "Acme Corp" },
        { id: "org-2", name: "Globex Inc" },
    ],
};

export const rolesFixture = {
    roles: [
        {
            id: "role-1",
            name: "Admin",
            type: "preset",
            customer: "cust-1",
            permissions: ["billing.read", "billing.write"],
        },
        {
            id: "role-2",
            name: "Viewer",
            type: "preset",
            customer: "cust-1",
            permissions: ["billing.read"],
        },
    ],
};

export const usersFixture = {
    rowCount: 2,
    users: [
        {
            id: "user-1",
            email: "alice@example.com",
            displayName: "Alice Smith",
            firstName: "Alice",
            lastName: "Smith",
            jobFunction: "Software / Ops Engineer",
            phone: "+1234567890",
            phoneExtension: "",
            language: "en",
            roleId: "role-1",
            organizationId: "org-1",
            status: "active",
        },
        {
            id: "user-2",
            email: "bob@example.com",
            displayName: "Bob Jones",
            firstName: "Bob",
            lastName: "Jones",
            jobFunction: "Finance / Accounting",
            phone: "+0987654321",
            phoneExtension: "",
            language: "en",
            roleId: "role-2",
            organizationId: "org-1",
            status: "active",
        },
    ],
};

export const updateUserFixture = {
    message: "User updated successfully",
    user: {
        id: "user-1",
        displayName: "Alice Johnson",
        firstName: "Alice",
        lastName: "Johnson",
        email: "alice@example.com",
        jobFunction: "Management",
        phone: "+1234567890",
        phoneExtension: "",
        language: "en",
        roleId: "role-1",
        organizationId: "org-1",
        status: "active",
    },
};

export const validateUserFixture = {
    domain: "example.com",
    email: "alice@example.com",
};

export const inviteUserFixture = {
    message: "User invited successfully",
    user: {
        id: "user-3",
        email: "invited@example.com",
        roleId: "role-1",
        organizationId: "org-1",
        status: "invited",
    },
};

export const accountTeamFixture = {
    accountManagers: [
        {
            email: "manager@doit.com",
            id: "mgr-123",
            name: "John Manager",
            role: "Account Manager",
            calendlyLink: "https://calendly.com/john-manager",
        },
        {
            email: "fsr@doit.com",
            id: "fsr-456",
            name: "Jane Strategist",
            role: "Field Sales Representative",
            calendlyLink: "https://calendly.com/jane-strategist",
        },
    ],
};

export const resourcePermissionsFixture = {
    id: "budget-1",
    name: "Q4 Cloud Spend",
    description: "Budget tracking for Q4",
    createTime: 1700000000000,
    updateTime: 1700100000000,
    permissions: [
        { user: "owner@example.com", role: "owner" },
        { user: "viewer@example.com", role: "viewer" },
    ],
    public: "viewer",
};

export const cancelInviteFixture = {
    id: "user-3",
    email: "invited@example.com",
    status: "invited",
    inviteStatus: "Cancelled",
};

export const resendInviteFixture = {
    id: "user-3",
    email: "invited@example.com",
    status: "invited",
    inviteStatus: "Pending",
    inviteExpiry: "2026-07-11T00:00:00Z",
};
