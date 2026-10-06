import { CLOUDFLOW_CODENODE_HINT, CLOUDFLOW_RETRY_HINT } from "../../docs/cloudflowGuidance.js";

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
