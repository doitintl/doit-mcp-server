import { CLOUDFLOW_CODENODE_HINT, CLOUDFLOW_RETRY_HINT } from "../../docs/cloudflowGuidance.js";

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
    import_cloudflow_flow: {
        descriptionSuffix:
            "Idempotency-Key is required even with dryRun. Same key/request replays within 24 hours; different request fails with 422, an in-progress match with 409. Dry-runs validate existing fingerprints without storing a replay. " +
            CLOUDFLOW_CODENODE_HINT +
            " " +
            CLOUDFLOW_RETRY_HINT,
    },
    export_cloudflow_flow: { descriptionSuffix: CLOUDFLOW_CODENODE_HINT },
    test_run_cloudflow_flow: {
        descriptionSuffix:
            "Generated codeNode code may fail silently or error at run time despite passing validation. " +
            "With dryRun this call shows only that the flow is well-formed; without dryRun it executes real actions even on drafts. " +
            "A completed run's per-node output (get_cloudflow_flow_run) shows whether it works. " +
            "The current generated MCP schema exposes no arbitrary trigger payload field; the API uses an empty payload when omitted. " +
            "Idempotency-Key is required even with dryRun. Same key/request replays within 24 hours; different request fails with 422, an in-progress match with 409. Dry-runs validate existing fingerprints without storing a replay. " +
            CLOUDFLOW_RETRY_HINT,
    },
    trigger_cloudflow_flow: {
        descriptionSuffix:
            "The current generated MCP schema exposes no arbitrary trigger payload field; the API uses an empty payload when omitted. trigger_cloud_flow accepts a webhook payload for published webhook flows.",
    },
};
