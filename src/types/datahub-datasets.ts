export type DatahubDataset = {
    name: string;
    description?: string;
    records?: number | null;
    updatedBy?: string;
    lastUpdated?: string;
};

export type DatahubDatasetsResponse = {
    datasets: DatahubDataset[];
};
