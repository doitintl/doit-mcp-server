import { CLOUDFLOW_BUILDER_HINT, CLOUDFLOW_CODENODE_HINT } from "../../docs/cloudflowGuidance.js";

export type ToolOverride = {
    /** Appended to the description composed from the OpenAPI spec, separated by a space. */
    descriptionSuffix?: string;
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
    import_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    export_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    test_run_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_BUILDER_HINT },
};
