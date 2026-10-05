import { CLOUDFLOW_CODENODE_HINT } from "../../docs/cloudflowGuidance.js";

export type ToolOverride = {
    /** Appended to the description composed from the OpenAPI spec, separated by a space. */
    descriptionSuffix?: string;
    /** Preserve a cursor carried in a response header in an export-only result envelope. */
    responsePageTokenHeader?: string;
};

/**
 * Prompt-shaped additions to generated tool descriptions, keyed by the snake_cased tool name
 * that `toolNameFor` derives (so `exportCloudflowFlow` → `export_cloudflow_flow`).
 *
 * A suffix rather than a replacement: the OpenAPI spec is the API's own contract and stays
 * authoritative about what an endpoint does. This file only adds what the spec has no business
 * carrying — runtime behavior a caller has to know to get a correct result.
 *
 * Every key is asserted against the real generated tool names in the tests, so renaming an
 * operation upstream fails the build instead of silently dropping the guidance.
 */
export const toolOverrides: Record<string, ToolOverride> = {
    export_datahub_dataset_records: {
        responsePageTokenHeader: "X-Next-Page-Token",
        descriptionSuffix:
            "This tool returns a JSON envelope with data (the unchanged CSV or JSONL page body) and pageToken (from X-Next-Page-Token). Pass a non-empty pageToken back as pageToken to advance; null means the final page. MCP does not expose the HTTP headers directly.",
    },
    import_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    export_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    test_run_cloudflow_flow: {
        descriptionSuffix:
            "Generated codeNode code is frequently broken in ways that pass validation and fail silently " +
            "at run time. With dryRun this call shows only that the flow is well-formed; a completed run's " +
            "per-node output (get_cloudflow_flow_run) shows whether it works.",
    },
};
