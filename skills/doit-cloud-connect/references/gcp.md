# Google Cloud Cloud Connect

Use `provider: gcp` and choose the scope:

| Scope | Identifiers | Use |
|---|---|---|
| `gcp_organization` | `organizationId` | Organization features and inherited project access. |
| `gcp_project` | `projectId` | Project features, including projects without an organization. |
| `gcp_dataset` | `projectId`, `datasetId` | One BigQuery dataset plus returned project prerequisites. |

Use a dedicated service account per customer and scope. Organization access does not replace
project-specific setup. Reconcile legacy connections with multiple organization bindings before writes.

For organization setup, use an existing host project for the service account. Never create
projects. If no suitable project is available, request an existing project from the customer.
Organization IAM setup does not require a new billing account. The operator needs
`iam.roles.get` and `iam.roles.create` on the organization, plus access to read
and update its IAM policy. Organization Admin alone does not include custom-role management;
an authorized administrator can grant Organization Role Administrator for that work. The host
project also needs service-account management and API-enablement access. Run the artifact plan
to check these permissions before applying; do not grant broader access automatically.

Domain-restricted sharing can reject the returned DoiT Token Creator principal, especially in
a new organization. If `iam.allowedPolicyMemberDomains` or `iam.managed.allowedPolicyMembers`
blocks that binding, stop before registration and involve the policy owner. Preserve the
organization restriction. Any authorized exception must cover only the necessary host project
and returned principal; do not disable organization-wide sharing restrictions or allow an entire
external domain automatically. See [Google's domain-restricted sharing guidance](https://docs.cloud.google.com/organization-policy/restrict-domains).

1. List with `provider: gcp` and the complete scope. Request fresh requirements for the desired
   features. Supply the organization account's host `identityInputs.projectId` and a dataset
   `serviceAccountId` when requested; respect entitlement and input findings.
2. Read the shell artifact's content, digest, parameters and changes. Run its read-only plan.
   Apply authorized changes through the existing IaC owner, or the returned script when appropriate.
   Preserve unrelated grants and conditions. The current setup binds the live service-account
   description to this customer; new registrations verify that marker. If an existing role lacks
   permissions, choose an unused `identityInputs.roleId` or involve its owner; the script never
   extends existing roles. Dataset setup also requires `bq`.
3. Preview and register with `identity.kind: gcp_service_account` and descriptor `serviceAccount`
   fields `email`, `uniqueId`, `projectId`; copy the artifact's `roleId` into `identity.roleId`.
   The setup script grants access but
   does not register. Never create or submit a private key. Include the chosen scope, features
   and returned feature inputs.
4. Inspect follow-ups and verification. After IAM changes, allow propagation and recheck the
   existing binding before repeating or broadening grants. Authentication checks identity;
   effective IAM checks are scope-specific. Dataset table samples can yield `partial` or `not_checked`; neither is a pass.
   IAM results do not prove service-perimeter access, feature readiness or data arrival.
5. Update with the current strong ETag and complete desired feature selection. Reconcile failed
   follow-ups through an update. Reuse an idempotency key only for an identical retry; re-read after
   a stale ETag or uncertain result.
6. Preview disconnect with `cleanupScope: doit_only`. Registration and owned DoiT metadata are
   removed; service accounts, IAM, datasets, sinks and pipelines remain. Remove customer resources
   separately through their owner only when authorized.

Billing signup, exports and organization creation are separate workflows.
