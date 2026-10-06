import { CLOUDFLOW_CODENODE_HINT } from "../../docs/cloudflowGuidance.js";

export type ToolOverride = {
    /** Appended to the description composed from the OpenAPI spec, separated by a space. */
    descriptionSuffix?: string;
    /** Preserve a cursor carried in a response header in an export-only result envelope. */
    responsePageTokenHeader?: string;
    /** Explicit operation semantics when the HTTP method does not indicate whether it writes. */
    readOnly?: boolean;
};

/**
 * MCP-specific overrides, keyed by the snake_cased tool name
 * that `toolNameFor` derives (so `exportCloudflowFlow` → `export_cloudflow_flow`).
 *
 * The OpenAPI spec remains authoritative about what an endpoint does. Description suffixes
 * add runtime guidance, while explicit read-only semantics handle lookups sent as POST.
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
    // Fetches selected layer components by ID; POST carries the component ID lists.
    get_statussheet_components: { readOnly: true },
    import_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    export_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    test_run_cloudflow_flow: {
        descriptionSuffix:
            "Generated codeNode code is frequently broken in ways that pass validation and fail silently " +
            "at run time. With dryRun this call shows only that the flow is well-formed; a completed run's " +
            "per-node output (get_cloudflow_flow_run) shows whether it works.",
    },
};
