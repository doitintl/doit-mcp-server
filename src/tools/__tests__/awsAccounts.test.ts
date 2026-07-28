import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeDoitRequest } from "../../utils/util.js";
import {
    CLOUDCONNECT_BASE_URL,
    createAwsAccountRoleTool,
    getAwsAccountTool,
    getCloudConnectSupportedFeaturesTool,
    handleCreateAwsAccountRoleRequest,
    handleGetAwsAccountRequest,
    handleGetCloudConnectSupportedFeaturesRequest,
} from "../awsAccounts.js";

vi.mock("../../utils/util.js", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, makeDoitRequest: vi.fn() };
});

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("getAwsAccountTool metadata", () => {
    it("should be read-only with the correct name", () => {
        expect(getAwsAccountTool.annotations.readOnlyHint).toBe(true);
        expect(getAwsAccountTool.annotations.destructiveHint).toBe(false);
        expect(getAwsAccountTool.name).toBe("get_aws_account");
    });
});

describe("get_aws_account", () => {
    const mockToken = "fake-token";

    const mockAccount = {
        accountID: "123456789012",
        roleArn: "arn:aws:iam::123456789012:role/doit",
        s3Bucket: "doit-billing",
        s3BucketRegion: "us-east-1",
        supportedFeatures: [{ name: "core", hasRequiredPermissions: true }],
        enabledFeatures: ["core"],
        timeLinked: "2026-01-01T00:00:00Z",
    };

    it("should call makeDoitRequest with the account ID in the URL and return account data", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockAccount);

        const response = await handleGetAwsAccountRequest({ accountID: "123456789012" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDCONNECT_BASE_URL}/aws/accounts/123456789012`, mockToken, {
            method: "GET",
            customerContext: undefined,
        });

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.accountID).toBe("123456789012");
        expect(parsed.roleArn).toBe("arn:aws:iam::123456789012:role/doit");
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockAccount);

        await handleGetAwsAccountRequest({ accountID: "123456789012", customerContext: "customer-123" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDCONNECT_BASE_URL}/aws/accounts/123456789012`, mockToken, {
            method: "GET",
            customerContext: "customer-123",
        });
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetAwsAccountRequest({ accountID: "123456789012" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("AWS account") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetAwsAccountRequest({ accountID: "123456789012" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when accountID is missing", async () => {
        const response = await handleGetAwsAccountRequest({}, mockToken);

        expect(response.isError).toBe(true);
    });

    it("should return error when accountID is only whitespace", async () => {
        const response = await handleGetAwsAccountRequest({ accountID: "   " }, mockToken);

        expect(response.isError).toBe(true);
    });
});

describe("getCloudConnectSupportedFeaturesTool metadata", () => {
    it("should be read-only with the correct name", () => {
        expect(getCloudConnectSupportedFeaturesTool.annotations.readOnlyHint).toBe(true);
        expect(getCloudConnectSupportedFeaturesTool.annotations.destructiveHint).toBe(false);
        expect(getCloudConnectSupportedFeaturesTool.name).toBe("get_cloud_connect_supported_features");
    });
});

describe("get_cloud_connect_supported_features", () => {
    const mockToken = "fake-token";

    const mockFeatures = {
        supportedFeatures: [
            { name: "core", hasRequiredPermissions: true },
            { name: "spot-scaling", hasRequiredPermissions: false },
        ],
    };

    it("should call makeDoitRequest with the account ID in the URL and return supported features", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockFeatures);

        const response = await handleGetCloudConnectSupportedFeaturesRequest({ accountID: "123456789012" }, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUDCONNECT_BASE_URL}/supportedFeatures/123456789012`,
            mockToken,
            { method: "GET", customerContext: undefined }
        );

        const text = response.content[0].text;
        const parsed = JSON.parse(text);
        expect(parsed.supportedFeatures).toHaveLength(2);
        expect(parsed.supportedFeatures[0].name).toBe("core");
        expect(parsed.supportedFeatures[1].hasRequiredPermissions).toBe(false);
    });

    it("should pass customerContext to makeDoitRequest", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockFeatures);

        await handleGetCloudConnectSupportedFeaturesRequest(
            { accountID: "123456789012", customerContext: "customer-123" },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(
            `${CLOUDCONNECT_BASE_URL}/supportedFeatures/123456789012`,
            mockToken,
            { method: "GET", customerContext: "customer-123" }
        );
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleGetCloudConnectSupportedFeaturesRequest({ accountID: "123456789012" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("supported features") }],
            isError: true,
        });
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleGetCloudConnectSupportedFeaturesRequest({ accountID: "123456789012" }, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });

    it("should return error when accountID is missing", async () => {
        const response = await handleGetCloudConnectSupportedFeaturesRequest({}, mockToken);

        expect(response.isError).toBe(true);
    });
});

describe("createAwsAccountRoleTool metadata", () => {
    it("should be a write tool with the correct name", () => {
        expect(createAwsAccountRoleTool.annotations.readOnlyHint).toBe(false);
        expect(createAwsAccountRoleTool.annotations.destructiveHint).toBe(true);
        expect(createAwsAccountRoleTool.name).toBe("create_aws_account_role");
        expect(createAwsAccountRoleTool.coversEndpoint).toBe("post:/core/v1/cloudconnect/aws/accounts");
    });
});

describe("create_aws_account_role", () => {
    const mockToken = "fake-token";

    const baseArgs = {
        accountID: "123456789012",
        roleArn: "arn:aws:iam::123456789012:role/DoiTRole",
        enabledFeatures: ["core"],
    };

    const mockResponse = {
        accountID: "123456789012",
        roleArn: "arn:aws:iam::123456789012:role/DoiTRole",
        enabledFeatures: ["core"],
    };

    it("should POST to the aws accounts endpoint with the body and return the response", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        const response = await handleCreateAwsAccountRoleRequest(baseArgs, mockToken);

        expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDCONNECT_BASE_URL}/aws/accounts`, mockToken, {
            method: "POST",
            body: {
                accountID: "123456789012",
                roleArn: "arn:aws:iam::123456789012:role/DoiTRole",
                enabledFeatures: ["core"],
            },
            customerContext: undefined,
        });

        const parsed = JSON.parse(response.content[0].text);
        expect(parsed.accountID).toBe("123456789012");
    });

    it("should include s3Bucket and s3BucketRegion when real-time-data is enabled", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

        await handleCreateAwsAccountRoleRequest(
            {
                ...baseArgs,
                enabledFeatures: ["real-time-data"],
                s3Bucket: "doit-cloudtrail",
                s3BucketRegion: "us-east-1",
                customerContext: "customer-123",
            },
            mockToken
        );

        expect(makeDoitRequest).toHaveBeenCalledWith(`${CLOUDCONNECT_BASE_URL}/aws/accounts`, mockToken, {
            method: "POST",
            body: {
                accountID: "123456789012",
                roleArn: "arn:aws:iam::123456789012:role/DoiTRole",
                enabledFeatures: ["real-time-data"],
                s3Bucket: "doit-cloudtrail",
                s3BucketRegion: "us-east-1",
            },
            customerContext: "customer-123",
        });
    });

    it("should error when real-time-data is enabled but the S3 bucket is missing", async () => {
        const response = await handleCreateAwsAccountRoleRequest(
            { ...baseArgs, enabledFeatures: ["real-time-data"] },
            mockToken
        );

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("real-time-data");
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should error when the S3 bucket is provided without real-time-data", async () => {
        const response = await handleCreateAwsAccountRoleRequest(
            { ...baseArgs, s3Bucket: "doit-cloudtrail", s3BucketRegion: "us-east-1" },
            mockToken
        );

        expect(response.isError).toBe(true);
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should error when only one of s3Bucket / s3BucketRegion is provided", async () => {
        const response = await handleCreateAwsAccountRoleRequest(
            { ...baseArgs, enabledFeatures: ["real-time-data"], s3Bucket: "doit-cloudtrail" },
            mockToken
        );

        expect(response.isError).toBe(true);
        expect(response.content[0].text).toContain("together");
        expect(makeDoitRequest).not.toHaveBeenCalled();
    });

    it("should error when enabledFeatures is empty", async () => {
        const response = await handleCreateAwsAccountRoleRequest({ ...baseArgs, enabledFeatures: [] }, mockToken);

        expect(response.isError).toBe(true);
    });

    it("should error when accountID is missing", async () => {
        const response = await handleCreateAwsAccountRoleRequest(
            { roleArn: baseArgs.roleArn, enabledFeatures: ["core"] },
            mockToken
        );

        expect(response.isError).toBe(true);
    });

    it("should return error response when API returns null", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockResolvedValue(null);

        const response = await handleCreateAwsAccountRoleRequest(baseArgs, mockToken);

        expect(response.isError).toBe(true);
    });

    it("should return error response when makeDoitRequest throws", async () => {
        (makeDoitRequest as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Network error"));

        const response = await handleCreateAwsAccountRoleRequest(baseArgs, mockToken);

        expect(response).toEqual({
            content: [{ type: "text", text: expect.stringContaining("Network error") }],
            isError: true,
        });
    });
});
