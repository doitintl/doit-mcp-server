export type BlacklistedEndpoint = { method: string; path: string };

/**
 * Endpoints already covered by a hand-written tool elsewhere in src/tools/.
 * Keyed by the OpenAPI spec's {method, path} pair (path uses the spec's own
 * {param} placeholders) so a generated tool is never registered for an
 * endpoint someone already hand-built a richer tool for.
 *
 * Add or remove entries here to control what the generator exposes — no
 * other code needs to change.
 */
export const BLACKLISTED_ENDPOINTS: BlacklistedEndpoint[] = [
    { method: "get", path: "/customers/v1/accountTeam" },
    { method: "get", path: "/analytics/v1/alerts" },
    { method: "post", path: "/analytics/v1/alerts" },
    { method: "get", path: "/analytics/v1/alerts/{id}" },
    { method: "patch", path: "/analytics/v1/alerts/{id}" },
    { method: "get", path: "/analytics/v1/allocations" },
    { method: "post", path: "/analytics/v1/allocations" },
    { method: "get", path: "/analytics/v1/allocations/{id}" },
    { method: "patch", path: "/analytics/v1/allocations/{id}" },
    { method: "get", path: "/analytics/v1/annotations" },
    { method: "post", path: "/analytics/v1/annotations" },
    { method: "get", path: "/analytics/v1/annotations/{id}" },
    { method: "patch", path: "/analytics/v1/annotations/{id}" },
    { method: "get", path: "/anomalies/v1" },
    { method: "get", path: "/anomalies/v1/{id}" },
    { method: "get", path: "/billing/v1/assets" },
    { method: "get", path: "/billing/v1/assets/{id}" },
    { method: "post", path: "/ava/v1/askSync" },
    { method: "get", path: "/core/v1/cloudconnect/aws/accounts/{accountID}" },
    {
        method: "get",
        path: "/core/v1/cloudconnect/supportedFeatures/{accountID}",
    },
    { method: "get", path: "/analytics/v1/budgets" },
    { method: "post", path: "/analytics/v1/budgets" },
    { method: "get", path: "/analytics/v1/budgets/{id}" },
    { method: "patch", path: "/analytics/v1/budgets/{id}" },
    { method: "post", path: "/clouddiagrams/v1/scheme/find" },
    { method: "get", path: "/clouddiagrams/v1/scheme/stats" },
    { method: "post", path: "/clouddiagrams/v1/scheme/search" },
    { method: "post", path: "/clouddiagrams/v1/scheme/get" },
    { method: "get", path: "/clouddiagrams/v1/statussheet/{id}/costs" },
    {
        method: "get",
        path: "/clouddiagrams/v1/statussheet/{id}/resources/{rid}/relationships",
    },
    { method: "get", path: "/clouddiagrams/v1/activity" },
    { method: "get", path: "/clouddiagrams/v1/activity/node-activities" },
    { method: "post", path: "/cloudflow/v1/trigger/{flowId}" },
    { method: "post", path: "/cloudflow/v1/flows/{flowId}/actions/refine" },
    { method: "get", path: "/cloudflow/v1/connections" },
    { method: "get", path: "/cloudflow/v1/connections/{connectionId}" },
    { method: "get", path: "/cloudflow/v1/templates" },
    { method: "get", path: "/cloudflow/v1/templates/{templateId}" },
    { method: "get", path: "/cloudflow/v1/flows" },
    { method: "get", path: "/core/v1/cloudincidents" },
    { method: "get", path: "/core/v1/cloudincidents/{id}" },
    { method: "get", path: "/analytics/v1/commitment-manager" },
    { method: "get", path: "/analytics/v1/commitment-manager/{id}" },
    { method: "get", path: "/datahub/v1/datasets" },
    { method: "get", path: "/datahub/v1/datasets/{name}" },
    { method: "post", path: "/datahub/v1/datasets" },
    { method: "patch", path: "/datahub/v1/datasets/{name}" },
    { method: "post", path: "/datahub/v1/events" },
    { method: "get", path: "/analytics/v1/dimension" },
    { method: "get", path: "/analytics/v1/dimensions" },
    { method: "get", path: "/analytics/v1/folders" },
    { method: "post", path: "/analytics/v1/folders" },
    { method: "get", path: "/analytics/v1/folders/{id}" },
    { method: "patch", path: "/analytics/v1/folders/{id}" },
    { method: "get", path: "/insights/v1/results" },
    {
        method: "get",
        path: "/insights/v1/results/source/{sourceID}/insight/{insightKey}/resource-results",
    },
    {
        method: "get",
        path: "/insights/v1/results/source/{sourceID}/insight/{insightKey}",
    },
    { method: "get", path: "/billing/v1/invoices" },
    { method: "get", path: "/billing/v1/invoices/{id}" },
    { method: "get", path: "/analytics/v1/labels" },
    { method: "post", path: "/analytics/v1/labels" },
    { method: "get", path: "/analytics/v1/labels/{id}" },
    { method: "patch", path: "/analytics/v1/labels/{id}" },
    { method: "get", path: "/analytics/v1/labels/{id}/assignments" },
    { method: "post", path: "/analytics/v1/labels/{id}/assignments" },
    { method: "get", path: "/iam/v1/organizations" },
    { method: "post", path: "/analytics/v1/reports/query" },
    { method: "get", path: "/sharing/v1/{resourceType}/{resourceId}" },
    // Spec declares PUT; the hand-written update_resource_permissions tool actually calls
    // PATCH on this same path. Blacklisted anyway — same conceptual operation, and a
    // generated tool here would just duplicate it under a colliding name.
    { method: "put", path: "/sharing/v1/{resourceType}/{resourceId}" },
    { method: "get", path: "/support/v1/metadata/platforms" },
    { method: "get", path: "/support/v1/metadata/products" },
    { method: "get", path: "/analytics/v1/reports" },
    { method: "post", path: "/analytics/v1/reports" },
    { method: "get", path: "/analytics/v1/reports/{id}" },
    { method: "get", path: "/analytics/v1/reports/{id}/config" },
    { method: "patch", path: "/analytics/v1/reports/{id}" },
    { method: "get", path: "/iam/v1/roles" },
    { method: "get", path: "/analytics/v1/settings/themes" },
    { method: "get", path: "/analytics/v1/settings/themes/{id}" },
    { method: "get", path: "/analytics/v1/settings/active-theme" },
    { method: "put", path: "/analytics/v1/settings/active-theme" },
    { method: "patch", path: "/analytics/v1/settings/themes/{id}" },
    { method: "get", path: "/support/v1/tickets" },
    { method: "post", path: "/support/v1/tickets" },
    { method: "get", path: "/support/v1/tickets/{ticketId}" },
    { method: "get", path: "/support/v1/tickets/{ticketId}/comments" },
    { method: "post", path: "/support/v1/tickets/{ticketId}/comments" },
    { method: "get", path: "/iam/v1/users" },
    { method: "patch", path: "/iam/v1/users/{id}" },
    { method: "post", path: "/iam/v1/users/invite" },
    { method: "get", path: "/auth/v1/validate" },
];

export function isBlacklisted(method: string, path: string): boolean {
    return BLACKLISTED_ENDPOINTS.some((entry) => entry.method === method.toLowerCase() && entry.path === path);
}
