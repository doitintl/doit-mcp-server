export const platformsFixture = {
    platforms: [
        { id: "google_cloud_platform", displayName: "Google Cloud Platform" },
        { id: "amazon_web_services", displayName: "Amazon Web Services" },
    ],
};

export const productsFixture = {
    products: [
        { id: "compute-engine", displayName: "Compute Engine", platform: "google_cloud_platform" },
        { id: "cloud-storage", displayName: "Cloud Storage", platform: "google_cloud_platform" },
    ],
};

export const ticketsFixture = {
    pageToken: "",
    rowCount: 1,
    tickets: [
        {
            createTime: 1700000000000,
            id: 12345,
            is_public: false,
            platform: "google_cloud_platform",
            product: "Compute Engine",
            requester: "alice@example.com",
            severity: "high",
            status: "open",
            subject: "VM not starting",
            updateTime: 1700100000000,
            urlUI: "https://console.doit.com/tickets/12345",
        },
    ],
};

export const ticketDetailFixture = {
    id: 12345,
    subject: "VM not starting",
    description: "The VM fails to boot after the last update. Checked logs but no clear error.",
    requester: "alice@example.com",
    severity: "high",
    platform: "google_cloud_platform",
    product: "Compute Engine",
    status: "open",
    createTime: 1700000000000,
    updateTime: 1700100000000,
    urlUI: "https://console.doit.com/tickets/12345",
    is_public: false,
};

export const ticketCommentsFixture = {
    comments: [
        {
            id: 1001,
            body: "Thank you for reaching out. We are investigating the issue.",
            author: "support@doit.com",
            created: 1700010000000,
            attachments: [],
        },
        {
            id: 1002,
            body: "We found the root cause. Please try restarting the VM.",
            author: "support@doit.com",
            created: 1700020000000,
            attachments: [],
        },
    ],
};
