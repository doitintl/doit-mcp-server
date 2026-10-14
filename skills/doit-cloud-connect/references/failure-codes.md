# Findings and recovery

Use the response's exact code, message, missing permissions/inputs and retry timing. Do not infer the cause from a generic HTTP failure.

| Code or condition | Next step |
|---|---|
| `catalog_version_stale` | Resolve fresh requirements; compare the changed static contract before retrying. |
| HTTP 412 / stale revision | Read the connection and review the proposed change against the new bindings. |
| `mutation_in_progress` or unfinished work | Read state and its follow-ups; do not start a conflicting mutation. |
| `identity_auth_failed` | Check deployed identity, tenant/account, federation/trust and customer-owned credentials. |
| `required_check_failed` | Inspect the specific permission/integration check and repair the authoritative cloud source. |
| `prerequisite_not_satisfied` | Satisfy the stated preceding check; later checks may correctly be not_checked. |
| `feature_not_entitled` | Resolve the customer's DoiT entitlement; changing cloud IAM cannot grant it. |
| `aws_asset_not_associated` | Complete the DoiT account association prerequisite outside this access setup. |
| `aws_management_account_unrecognized` / `not_payer_account` | Resolve the correct management/payer context before organization deployment. |
| `registration_incomplete` / failed follow-up | Repair the named backend step and retry it using a conditional PATCH. |
| `connection_ambiguous` | Resolve competing identities/records before mutation; do not choose arbitrarily. |
| `adapter_check_unsupported` / incomplete sample | Preserve an unverified result; do not report healthy access. |
| HTTP 503 during event publication | Some events may already be published. Retry at most twice if opted in; telemetry failure does not block setup. |
| Missing recent diagnostic event | Allow for audit visibility delay; use fresh connection reads/verification for completion. |

If a repair repeatedly fails with the same evidence, summarize the unresolved prerequisite and preserve request correlation for support instead of repeating destructive actions.
