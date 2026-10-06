export type SupportedFeature = {
    name: string;
    hasRequiredPermissions: boolean;
};

export type AwsAccount = {
    accountID: string;
    roleArn?: string;
    s3Bucket?: string;
    s3BucketRegion?: string;
    supportedFeatures?: SupportedFeature[];
    enabledFeatures?: string[];
    timeLinked?: string;
};

export type SupportedFeaturesResponse = {
    supportedFeatures: SupportedFeature[];
};
