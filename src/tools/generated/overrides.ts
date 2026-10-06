import { CLOUDFLOW_BUILDER_HINT, CLOUDFLOW_CODENODE_HINT } from "../../docs/cloudflowGuidance.js";

export type ToolOverride = {
    /** Appended to the description composed from the OpenAPI spec, separated by a space. */
    descriptionSuffix?: string;
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
    // Fetches selected layer components by ID; POST carries the component ID lists.
    get_statussheet_components: { readOnly: true },
    import_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    export_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    test_run_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_BUILDER_HINT },
};
