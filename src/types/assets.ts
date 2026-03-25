export type Asset = {
    createTime: number;
    id: string;
    name: string;
    quantity: number;
    type: string;
    url: string;
};

export type SubscriptionPlanCommitmentInterval = {
    endTime?: number;
    startTime?: number;
};

export type SubscriptionPlan = {
    commitmentInterval?: SubscriptionPlanCommitmentInterval;
    isCommitmentPlan?: boolean;
    planName?: string;
};

export type Seats = {
    licensedNumberOfSeats?: number;
    maximumNumberOfSeats?: number;
    numberOfSeats?: number;
};

export type RenewalSettings = {
    renewalType?: string;
};

export type Subscription = {
    billingMethod?: string;
    creationTime?: number;
    id?: string;
    plan?: SubscriptionPlan;
    purchaseOrderID?: string;
    renewalSettings?: RenewalSettings;
    resourceUIURL?: string;
    seats?: Seats;
    skuID?: string;
    skuName?: string;
    status?: string;
};

export type AssetProperties = {
    customerDomain?: string;
    customerID?: string;
    reseller?: string;
    subscription?: Subscription;
};

export type AssetDetailed = Asset & {
    properties?: AssetProperties;
};

export type ListAssetsResponse = {
    assets: Asset[];
    pageToken?: string;
    rowCount: number;
};
