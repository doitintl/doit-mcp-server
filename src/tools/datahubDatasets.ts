import { z } from "zod";
import { zodToMcpInputSchema } from "../utils/schemaHelpers.js";
import {
    createErrorResponse,
    createSuccessResponse,
    DOIT_API_BASE,
    formatZodError,
    handleGeneralError,
    makeDoitRequest,
} from "../utils/util.js";

export const DATAHUB_DATASETS_BASE_URL = `${DOIT_API_BASE}/datahub/v1/datasets`;

export const DATASET_NAME_PATTERN = /^[a-zA-Z0-9_-]+( [a-zA-Z0-9_-]+)*$/;

// Lenient name schema for get/update — only trims and checks non-empty, so existing datasets
// with names predating the current naming rules can still be accessed and updated.
const DatasetNameLookupSchema = z
    .string()
    .transform((val) => val.trim())
    .pipe(z.string().min(1, "Dataset name is required and cannot be empty."));

// Strict name schema for create — enforces the API's naming pattern.
const DatasetNameCreateSchema = z
    .string()
    .transform((val) => val.trim())
    .pipe(
        z
            .string()
            .min(1, "Dataset name is required and cannot be empty.")
            .regex(
                DATASET_NAME_PATTERN,
                "Dataset name may only contain alphanumeric characters (0-9,a-z,A-Z), underscores (_), dashes (-), and spaces between words."
            )
    );

// Schema and metadata for list datahub datasets
export const ListDatahubDatasetsArgumentsSchema = z.object({});

export const listDatahubDatasetsTool = {
    name: "list_datahub_datasets",
    description:
        "Use this when the user wants to see available DataHub datasets. Returns a list of datasets with metadata. Do NOT use this for billing data (use run_query) or assets (use list_assets).",
    inputSchema: zodToMcpInputSchema(ListDatahubDatasetsArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading datasets...",
        "openai/toolInvocation/invoked": "Datasets loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleListDatahubDatasetsRequest(args: any, token: string) {
    try {
        ListDatahubDatasetsArgumentsSchema.parse(args);
        const { customerContext } = args;

        const data = await makeDoitRequest(DATAHUB_DATASETS_BASE_URL, token, {
            method: "GET",
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to retrieve DataHub datasets");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling list datahub datasets request");
    }
}

// Schema and metadata for get datahub dataset
export const GetDatahubDatasetArgumentsSchema = z.object({
    name: DatasetNameLookupSchema.describe("The name of the dataset to retrieve."),
});

export const getDatahubDatasetTool = {
    name: "get_datahub_dataset",
    description:
        "Use this when the user wants to view details of a specific DataHub dataset by its ID. Returns full dataset metadata and schema. Do NOT use this for listing all datasets (use list_datahub_datasets) or cost queries (use run_query).",
    inputSchema: zodToMcpInputSchema(GetDatahubDatasetArgumentsSchema),
    annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Loading dataset...",
        "openai/toolInvocation/invoked": "Dataset loaded",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data"] }],
};

export async function handleGetDatahubDatasetRequest(args: any, token: string) {
    try {
        const { name } = GetDatahubDatasetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const url = `${DATAHUB_DATASETS_BASE_URL}/${encodeURIComponent(name)}`;

        const data = await makeDoitRequest(url, token, { method: "GET", customerContext });

        if (!data) {
            return createErrorResponse("Failed to retrieve DataHub dataset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling get datahub dataset request");
    }
}

// Schema and metadata for create datahub dataset
export const CreateDatahubDatasetArgumentsSchema = z.object({
    name: DatasetNameCreateSchema.describe(
        "The name of the dataset (required). Allowed characters: alphanumeric (0-9,a-z,A-Z), underscore (_), dash (-), and spaces between words."
    ),
    description: z.string().optional().describe("An optional description for the dataset."),
});

export const createDatahubDatasetTool = {
    name: "create_datahub_dataset",
    description:
        "Use this when the user wants to create a new DataHub dataset. Ask the user to confirm the dataset name and description before executing. Do NOT use this for viewing datasets (use list_datahub_datasets) or sending events (use send_datahub_events).",
    inputSchema: zodToMcpInputSchema(CreateDatahubDatasetArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    summary: (args: any) => {
        const desc = args?.description ? ` — "${String(args.description).slice(0, 80)}"` : "";
        return `Create DataHub dataset "${args?.name ?? "<unnamed>"}"${desc}.`;
    },
    _meta: {
        "openai/toolInvocation/invoking": "Creating DataHub dataset...",
        "openai/toolInvocation/invoked": "DataHub dataset created",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleCreateDatahubDatasetRequest(args: any, token: string) {
    try {
        const parsed = CreateDatahubDatasetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const body = { ...parsed };

        const data = await makeDoitRequest(DATAHUB_DATASETS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to create DataHub dataset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling create datahub dataset request");
    }
}

// Schema and metadata for update datahub dataset
const UpdateDatahubDatasetBaseSchema = z.object({
    name: DatasetNameLookupSchema.describe(
        "The name of the dataset to update (required). Used for identification; the name cannot be changed."
    ),
    description: z
        .string()
        .optional()
        .describe("The new description for the dataset. At least one updatable field (description) must be provided."),
});

export const UpdateDatahubDatasetArgumentsSchema = UpdateDatahubDatasetBaseSchema.refine(
    (data) => data.description !== undefined,
    {
        message: "At least one updatable field must be provided. Currently only 'description' can be updated.",
    }
);

export const updateDatahubDatasetTool = {
    name: "update_datahub_dataset",
    description:
        "Use this when the user wants to modify an existing DataHub dataset's description. The dataset name is required to identify the dataset; only the description can be changed. Ask the user to confirm the changes before executing. Do NOT use this for creating datasets (use create_datahub_dataset) or listing datasets (use list_datahub_datasets).",
    inputSchema: zodToMcpInputSchema(UpdateDatahubDatasetArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    summary: (args: any) =>
        `Update DataHub dataset "${args?.name ?? "<unknown>"}" — description → "${
            args?.description !== undefined ? String(args.description).slice(0, 80) : "(unchanged)"
        }".`,
    _meta: {
        "openai/toolInvocation/invoking": "Updating DataHub dataset...",
        "openai/toolInvocation/invoked": "DataHub dataset updated",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleUpdateDatahubDatasetRequest(args: any, token: string) {
    try {
        const parsed = UpdateDatahubDatasetArgumentsSchema.parse(args);
        const { customerContext } = args;
        const { name, ...body } = parsed;
        const url = `${DATAHUB_DATASETS_BASE_URL}/${encodeURIComponent(name)}`;

        const data = await makeDoitRequest(url, token, {
            method: "PATCH",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to update DataHub dataset");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling update datahub dataset request");
    }
}
