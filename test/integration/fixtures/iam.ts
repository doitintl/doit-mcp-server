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
            jobFunction: "Engineering",
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
            jobFunction: "Finance",
            phone: "+0987654321",
            phoneExtension: "",
            language: "en",
            roleId: "role-2",
            organizationId: "org-1",
            status: "active",
        },
    ],
};

export const validateUserFixture = {
    domain: "example.com",
    email: "alice@example.com",
};
