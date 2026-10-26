# Google Cloud Cloud Connect

Choose the native scope before requesting requirements:

| Scope | Required identifiers | Use |
|---|---|---|
| `gcp_organization` | `organizationId` | Organization features and inherited access across projects. Requires organization IAM administration. |
| `gcp_project` | `projectId` | Project features, including projects with no organization. |
| `gcp_dataset` | `projectId`, `datasetId` | Access to a specific existing BigQuery dataset, plus separately returned project prerequisites. |

Every scope uses `provider: "gcp"`. Use a service account dedicated to one customer and scope; an identity already registered to another customer cannot be claimed again. A project binding remains useful when an organization connection exists: some features need project setup or a project-specific identity. Do not request organization IAM access merely because the customer uses a company account.

1. List with `provider: "gcp"` and the complete native scope. Inspect existing service-account ownership. A legacy organization connection may contain several organization bindings; reconcile that layout before mutating it through these tools.
2. Request fresh requirements for the chosen scope and features. Supply `identityInputs.projectId` for the service-account host project when requested; optional `serviceAccountId` and `roleId` select customer-owned names. Respect entitlement, prerequisite and missing-input findings.
3. Read the returned shell artifact's `content`, version, parameters and proposed changes. Save it and its parameters locally. Run its default read-only plan; use `--apply` only within the customer's authorization and owning workflow. If existing IaC owns a role, account or grant, update that source instead. Preserve unrelated grants and conditions. Dataset setup requires `bq` as well as `gcloud`, `jq` and Bash.
4. The script produces a **service-account descriptor**, not a private key. Use only its `email`, `uniqueId` and `projectId` under `identity: {kind: "gcp_service_account", serviceAccount: {...}}`, with optional `roleId`. Never create, upload or send a service-account private key. Registration is manual through `register_cloud_connection` after a successful preview and live cloud setup. Match the scope and selected features to the requirements; include returned feature inputs such as sink location.
5. Inspect follow-ups and verification. Impersonation proves the account identity; effective permission observations are scope-specific. Dataset checks sample tables and report incomplete or truncated coverage. IAM permission results do not prove service-perimeter access, feature readiness or data arrival. A `not_checked` or `partial` result is not full acceptance.
6. For updates, read the current connection and carry its exact strong ETag into preview and apply. Send the complete desired feature selection. Retry failed follow-ups by reconciling through an update; preserve an identical idempotency key only when retrying an identical write. Re-read after a stale ETag or uncertain response.
7. Disconnect with `cleanupScope: "doit_only"`. Review the preview and retained resources. Registration and owned DoiT metadata are removed; customer service accounts, IAM roles/grants, datasets, log sinks and pipeline resources remain. Remove customer resources separately through their owner only when authorized.

GCP billing signup, billing exports and organization creation are separate workflows. These tools do not turn a personal Google account into an organization.
