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
    coversEndpoint: {
        method: "get",
        path: "/core/v1/cloudconnect/aws/accounts/{accountID}",
    },
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
        const data = await makeDoitRequest<AwsAccount>(url, token, {
            method: "GET",
            customerContext,
        });

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
    coversEndpoint: {
        method: "get",
        path: "/core/v1/cloudconnect/supportedFeatures/{accountID}",
    },
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
