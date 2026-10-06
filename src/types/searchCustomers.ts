interface FlexsaveSummary {
    aws: boolean;
    gcp: boolean;
}

interface CustomerSummary {
    id: string;
    name: string;
    primaryDomain: string;
    domains?: string[];
    classification?: string;
    type?: string;
    segment?: string;
    monthlyCloudSpend?: number;
    tierPackages?: string[];
    assetPlatforms?: string[];
    accountTeam?: string[];
    flexsave?: FlexsaveSummary;
    invoicedTotal?: number;
    matched?: string[];
}

export interface SearchCustomersResponse {
    customers: CustomerSummary[];
    nextPageToken: string;
    truncated: boolean;
}
