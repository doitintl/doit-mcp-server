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
import { DATASET_NAME_PATTERN } from "./datahubDatasets.js";

export const DATAHUB_EVENTS_BASE_URL = `${DOIT_API_BASE}/datahub/v1/events`;

const DatahubDimensionSchema = z.object({
    key: z
        .string()
        .min(1)
        .describe(
            "Dimension key. For fixed dimensions, allowed keys are billing_account_id, project_id, project_name, project_number, service_description, service_id, sku_description, sku_id, operation, resource_id, resource_global_id, country, region, zone, pricing_unit, cost_type, is_marketplace."
        ),
    type: z
        .enum(["fixed", "label", "project_label", "system_label"])
        .describe("The dimension type. Accepted values: fixed, label, project_label, system_label."),
    value: z
        .union([z.string(), z.boolean()])
        .describe(
            "String value, except fixed is_marketplace, which accepts a boolean or the exact string 'true' or 'false'. Boolean values are not accepted for other keys or dimension types."
        ),
});

const DatahubMetricSchema = z.object({
    value: z.number().describe("The metric value (numeric)."),
    type: z
        .string()
        .min(1)
        .describe(
            "The metric type. Use 'cost' or 'usage' to map to built-in Cloud Analytics metrics, or a custom string (e.g. 'working_hours')."
        ),
});

const DatahubEventSchema = z.object({
    provider: z
        .string()
        .min(1)
        .regex(
            DATASET_NAME_PATTERN,
            "Provider may only contain alphanumeric characters, underscores, dashes, and spaces between words."
        )
        .describe(
            "The dataset name used as the provider (required). Allowed characters: alphanumeric (0-9,a-z,A-Z), underscore (_), dash (-), and spaces between words. Example: 'Datadog'."
        ),
    id: z
        .string()
        .optional()
        .describe(
            "An event ID unique within the dataset. Supplied IDs must also be unique across the entire request, including across providers. If omitted, the server generates a UUIDv4."
        ),
    time: z
        .string()
        .min(1)
        .datetime({ message: "Must be a valid ISO 8601 / RFC 3339 date-time string (e.g. 2026-10-01T23:00:00Z)." })
        .describe(
            "The event timestamp (required). Use a UTC RFC 3339 timestamp ending in Z. The API requires a time within 730 days before or after its current time."
        ),
    dimensions: z
        .array(DatahubDimensionSchema)
        .optional()
        .describe("Optional list of dimensions (key/type/value triples) to categorize this event."),
    metrics: z
        .array(DatahubMetricSchema)
        .optional()
        .describe("Optional list of at most 255 metrics associated with this event."),
});

export const SendDatahubEventsArgumentsSchema = z.object({
    events: z
        .array(DatahubEventSchema)
        .min(1, "At least one event is required.")
        .max(50000, "A maximum of 50,000 events can be sent per request.")
        .describe(
            "Array of DataHub events to ingest (required). Each event requires a provider and time. Accepts 1 to 50,000 events per call."
        ),
});

export const sendDatahubEventsTool = {
    name: "send_datahub_events",
    title: "Send DataHub events",
    coversEndpoint: "post:/datahub/v1/events",
    description:
        "Use this when the user wants to send DataHub events for ingestion (1–50,000 events per call). Each event requires a provider name and an RFC 3339 timestamp, and can optionally include dimensions and metrics. The API validates the entire request atomically, including duplicate event IDs anywhere in the request; a validation failure rejects the whole request. Success means accepted for asynchronous processing, not that records are already queryable. No processing latency is guaranteed. Do NOT use this for creating datasets (use create_datahub_dataset) or viewing datasets (use list_datahub_datasets).",
    inputSchema: zodToMcpInputSchema(SendDatahubEventsArgumentsSchema),
    annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
    },
    _meta: {
        "openai/toolInvocation/invoking": "Sending DataHub events...",
        "openai/toolInvocation/invoked": "DataHub events sent",
    },
    securitySchemes: [{ type: "oauth2", scopes: ["read_data", "write_data"] }],
};

export async function handleSendDatahubEventsRequest(args: any, token: string) {
    try {
        const parsed = SendDatahubEventsArgumentsSchema.parse(args);
        const { customerContext } = args;
        const body = { ...parsed };

        const data = await makeDoitRequest(DATAHUB_EVENTS_BASE_URL, token, {
            method: "POST",
            body,
            customerContext,
        });

        if (!data) {
            return createErrorResponse("Failed to send DataHub events");
        }

        return createSuccessResponse(JSON.stringify(data, null, 2));
    } catch (error) {
        if (error instanceof z.ZodError) return createErrorResponse(formatZodError(error));
        return handleGeneralError(error, "handling send datahub events request");
    }
}
