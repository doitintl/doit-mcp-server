import { z } from "zod";
import type { AwsAccount, SupportedFeaturesResponse } from "../types/awsAccounts.js";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const CLOUDCONNECT_BASE_URL = `${DOIT_API_BASE}/core/v1/cloudconnect`;

// Schema and metadata for get AWS account
export const GetAwsAccountArgumentsSchema = z.object({
    accountID: z.string().trim().min(1).describe('The AWS account ID to retrieve (e.g. "123456789012").'),
});

export const getAwsAccountTool = {
    name: "get_aws_account",
    coversEndpoint: "get:/core/v1/cloudconnect/aws/accounts/{accountID}",
    description:
        "Use this when the user wants the CloudConnect details of a specific connected AWS account, such as its IAM role ARN, billing S3 bucket, and which DoiT features are enabled or supported. Requires the 12-digit AWS account ID. Do NOT use this for Google Cloud or Azure accounts.",
    inputSchema: zodToMcpInputSchema(GetAwsAccountArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading AWS account...",
        "openai/toolInvocation/invoked": "AWS account loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetAwsAccountRequest(args: any, token: string) {
    try {
        const { accountID } = GetAwsAccountArgumentsSchema.parse(args);
        const { customerContext } = args;

        const url = `${CLOUDCONNECT_BASE_URL}/aws/accounts/${encodeURIComponent(accountID)}`;
        const data = await makeDoitRequest<AwsAccount>(url, token, { method: "GET", customerContext });

        if (!data) {
            return createErrorResponse("Failed to retrieve AWS account");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get AWS account request");
    }
}

// Schema and metadata for get CloudConnect supported features
export const GetCloudConnectSupportedFeaturesArgumentsSchema = z.object({
    accountID: z
        .string()
        .trim()
        .min(1)
        .describe("The cloud provider account ID (AWS account ID or Azure tenant ID) to check supported features for."),
});

export const getCloudConnectSupportedFeaturesTool = {
    name: "get_cloud_connect_supported_features",
    coversEndpoint: "get:/core/v1/cloudconnect/supportedFeatures/{accountID}",
    description:
        "Use this when the user wants to know which DoiT CloudConnect features a connected cloud account supports and whether the account currently has the required permissions for each feature. Accepts an AWS account ID or Azure tenant ID. Returns the list of supported features with their permission status.",
    inputSchema: zodToMcpInputSchema(GetCloudConnectSupportedFeaturesArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading supported features...",
        "openai/toolInvocation/invoked": "Supported features loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetCloudConnectSupportedFeaturesRequest(args: any, token: string) {
    try {
        const { accountID } = GetCloudConnectSupportedFeaturesArgumentsSchema.parse(args);
        const { customerContext } = args;

        const url = `${CLOUDCONNECT_BASE_URL}/supportedFeatures/${encodeURIComponent(accountID)}`;
        const data = await makeDoitRequest<SupportedFeaturesResponse>(url, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve supported features");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get CloudConnect supported features request");
    }
}

// The feature name that gates the S3 bucket requirement (see schema description below).
export const REAL_TIME_FEATURE = "real-time-data";

// Schema and metadata for create/update AWS account role
export const CreateAwsAccountRoleArgumentsSchema = z.object({
    accountID: z.string().trim().min(1).describe('The 12-digit AWS account ID to connect (e.g. "123456789012").'),
    roleArn: z
        .string()
        .trim()
        .min(1)
        .describe('The ARN of the IAM role created for DoiT access (e.g. "arn:aws:iam::123456789012:role/DoiTRole").'),
    enabledFeatures: z
        .array(z.string().trim().min(1))
        .min(1)
        .describe(
            'The DoiT CloudConnect features to enable for this account (e.g. ["real-time-data"]). Values must match supported feature names configured in DoiT. When "real-time-data" is included, s3Bucket and s3BucketRegion are required; when it is not included, they must be omitted.'
        ),
    s3Bucket: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe(
            'S3 bucket name for CloudTrail real-time anomaly detection. Required together with s3BucketRegion, and only allowed when enabledFeatures includes "real-time-data".'
        ),
    s3BucketRegion: z
        .string()
        .trim()
        .min(1)
        .optional()
        .describe('AWS region of the S3 bucket (e.g. "us-east-1"). Required together with s3Bucket.'),
});

export const createAwsAccountRoleTool = {
    name: "create_aws_account_role",
    coversEndpoint: "post:/core/v1/cloudconnect/aws/accounts",
    description:
        'Use this when the user wants to connect an AWS account to DoiT CloudConnect (or update an existing connection) by registering the IAM role ARN and declaring which DoiT features to enable. This creates or updates the CloudConnect document for the AWS account. Ask the user to confirm the account ID, role ARN, and features before executing. When enabling real-time anomaly detection ("real-time-data"), the CloudTrail S3 bucket name and region are required. Do NOT use this for Google Cloud or Azure accounts.',
    inputSchema: zodToMcpInputSchema(CreateAwsAccountRoleArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Connecting AWS account...",
        "openai/toolInvocation/invoked": "AWS account connected",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleCreateAwsAccountRoleRequest(args: any, token: string) {
    try {
        const { accountID, roleArn, enabledFeatures, s3Bucket, s3BucketRegion } =
            CreateAwsAccountRoleArgumentsSchema.parse(args);
        const { customerContext } = args;

        // The API requires s3Bucket and s3BucketRegion together, and only when the
        // real-time-data feature is enabled. Validate here rather than in the Zod schema so
        // the exported schema stays a plain object (the remote worker registers it via
        // `schema.shape`, which ZodEffects from .refine() would not expose).
        const hasRealTime = enabledFeatures.includes(REAL_TIME_FEATURE);
        if ((s3Bucket === undefined) !== (s3BucketRegion === undefined)) {
            return createErrorResponse("s3Bucket and s3BucketRegion must be provided together.");
        }
        if (hasRealTime && s3Bucket === undefined) {
            return createErrorResponse(
                `s3Bucket and s3BucketRegion are required when enabledFeatures includes "${REAL_TIME_FEATURE}".`
            );
        }
        if (!hasRealTime && s3Bucket !== undefined) {
            return createErrorResponse(
                `s3Bucket and s3BucketRegion are only allowed when enabledFeatures includes "${REAL_TIME_FEATURE}".`
            );
        }

        const body: Record<string, unknown> = { accountID, roleArn, enabledFeatures };
        if (s3Bucket !== undefined) body.s3Bucket = s3Bucket;
        if (s3BucketRegion !== undefined) body.s3BucketRegion = s3BucketRegion;

        const url = `${CLOUDCONNECT_BASE_URL}/aws/accounts`;
        const data = await makeDoitRequest<AwsAccount>(url, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create or update AWS account role");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create AWS account role request");
    }
}
