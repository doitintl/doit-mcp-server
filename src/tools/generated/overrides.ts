import { CLOUDFLOW_CODENODE_HINT, CLOUDFLOW_RETRY_HINT } from "../../docs/cloudflowGuidance.js";

export type ToolOverride = {
    /** Appended to the description composed from the OpenAPI spec, separated by a space. */
    descriptionSuffix?: string;
    /** Preserve a cursor carried in a response header in an export-only result envelope. */
    responsePageTokenHeader?: string;
    /** Explicit operation semantics when the HTTP method does not indicate whether it writes. */
    readOnly?: boolean;
    /**
     * Opts a read-only list operation with no upstream paging into server-side result paging
     * (src/utils/resultPaging.ts). Only for operations that return a record list.
     */
    resultPaged?: true;
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
    // List operations whose endpoints return every record at once: oversized results are split
    // into continuation pages (src/utils/resultPaging.ts). Operations that page upstream through
    // `after`/`nextCursor` (Attribute) and responses without a record array stay out.
    list_billing_transfer_end_customers: { resultPaged: true },
    list_billing_transfer_end_customers_by_reseller: { resultPaged: true },
    list_billing_transfer_reseller_accounts: { resultPaged: true },
    list_billing_transfer_reseller_accounts_with_tenants: { resultPaged: true },
    list_budget_suggestions: { resultPaged: true },
    list_cloud_diagram_layer_snapshots: { resultPaged: true },
    list_contract_templates: { resultPaged: true },
    list_contracts: { resultPaged: true },
    list_customer_group_user_groups: { resultPaged: true },
    list_customer_group_users: { resultPaged: true },
    list_customer_groups: { resultPaged: true },
    list_customer_notifications: { resultPaged: true },
    list_gcp_recommendations: { resultPaged: true },
    list_geographic_access_countries: { resultPaged: true },
    list_geographic_access_custom_regions: { resultPaged: true },
    list_service_account_tokens: { resultPaged: true },
    list_service_accounts: { resultPaged: true },
    list_shared_payer_account_mappings: { resultPaged: true },
    list_shared_payer_management_accounts: { resultPaged: true },
    list_shared_payers: { resultPaged: true },
    list_ticket_tags: { resultPaged: true },
    list_user_notifications: { resultPaged: true },
    list_widgets: { resultPaged: true },
};
