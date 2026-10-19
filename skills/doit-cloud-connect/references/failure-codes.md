# Findings and recovery

Use the response's exact code, detail, `details`, missing permissions/inputs and `retryable`. Service codes are `onboarding.<code>`.

| Code or condition | Next step |
|---|---|
| `onboarding.catalog_version_stale` | Resolve fresh requirements, review changed permissions/artifacts, then retry with the new `catalogVersion`. |
| `onboarding.connection_exists` | A record exists for the account (`details` carries its `id`). Read it; change it with a reviewed conditional update. Do not redeploy expecting a new registration. |
| `onboarding.registration_gate_failed` | The live check (AssumeRole + GetRole) failed. Check role ARN, trust principal and External ID (the DoiT customer ID), and role existence in the right account. |
| `onboarding.cleanup_failed` | The record is kept. Read `details` for failed steps; retry the same removal with a fresh `etag`. |
| `412` stale `etag` | Read the connection and review the change against the current state. |
| `428` | Send `If-Match` with the latest `etag`. |
| `415` | PATCH is JSON merge patch; the tool sets this, so a hand-built call must too. |
| `400 idempotency_key_required` / `422 idempotency_key_reused` | Use one key per logical write and the same key only for the identical body. |
| `409 idempotency_request_in_progress` | The first attempt is still running. Wait, then read state; do not start a conflicting write. |
| `onboarding.provider_unsupported` | Only AWS accounts are supported; stop. |
| `validation_failed` | Fix the named field. Check the account ID digits and that real-time inputs are complete. |
| `aws_broker_requires_registration` (dry-run authentication) | A new role cannot be probed before registration. Explain the limit and proceed with authorized registration. |
| `aws_asset_not_associated` | Complete the DoiT account association outside this setup; IAM changes cannot fix it. |
| `aws_management_account_unrecognized` / `not_payer_account` | Resolve the correct management/payer context before an organization deployment. |
| `feature_not_entitled` | Resolve DoiT entitlement; cloud IAM cannot grant it. |
| verify: authentication `failed` | Every feature is `not_checked`. Repair trust, External ID or role existence first. |
| verify: `required_permission_missing` | `missingPermissions` lists what is absent; fix the authoritative IAM source and apply in place. |
| verify: `entitlement` / `catalog_preconditions` check failed | The customer's entitlement or the stored selection no longer fits the current catalog; re-resolve requirements. |
| failed follow-up (e.g. real-time bucket) | Repair the named step's cause (often a bucket resource policy) and re-send the current desired state with a conditional update. |
| HTTP 503 / `retryable: true` | Retry within a bounded policy using the same idempotency key for the identical write. |

If a repair repeatedly fails with the same evidence, summarize the unresolved prerequisite and keep the `requestId` values for support instead of repeating destructive actions.
