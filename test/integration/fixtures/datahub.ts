export const datahubDatasetsFixture = {
    datasets: [
        {
            name: "My Custom Dataset",
            description: "Dataset for tracking custom business metrics",
            records: 1500,
            updatedBy: "user@example.com",
            lastUpdated: "2024-03-10T23:00:00Z",
        },
        {
            name: "Revenue Tracking",
            description: "Monthly revenue data",
            records: 800,
            updatedBy: "admin@example.com",
            lastUpdated: "2024-03-15T10:00:00Z",
        },
    ],
};

export const datahubDatasetFixture = {
    name: "My Custom Dataset",
    description: "Dataset for tracking custom business metrics",
    records: 1500,
    updatedBy: "user@example.com",
    lastUpdated: "2024-03-10T23:00:00Z",
};

export const createDatahubDatasetFixture = {
    name: "New Dataset",
    description: "A new dataset for tracking metrics",
    records: null,
    updatedBy: "user@example.com",
    lastUpdated: "2024-03-15T12:00:00Z",
};

export const updateDatahubDatasetFixture = {
    name: "My Custom Dataset",
    description: "Updated description for the dataset",
    records: 1500,
    updatedBy: "user@example.com",
    lastUpdated: "2024-03-16T10:00:00Z",
};

export const sendDatahubEventsFixture = {
    message: "Ingestion success",
};
