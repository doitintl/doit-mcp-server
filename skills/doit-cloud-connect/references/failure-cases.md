# Failure cases and possible checks

Use the response's exact `code`, `detail`, `details`, `retryable` and `requestId`, together with current connection state and the customer's environment. These cases describe API conditions, not necessarily resolved customer incidents. The checks below are non-exhaustive. Choose an action from the evidence and the customer's deployment workflow.

| Code or condition | Response meaning | Possible checks |
|---|---|---|
| `onboarding.catalog_version_stale` | The submitted catalog version is no longer current. | Compare fresh requirements with the proposed change before preparing another write. |
| `onboarding.connection_exists` | A connection already exists; `details` identifies it. | Read that connection and compare it with the requested outcome. A desired-state change uses a conditional update. |
| `onboarding.registration_gate_failed` | Authentication, a prerequisite or another finding blocked the mutation. | Inspect the specific `details` and current requirements to identify the failed gate before choosing a repair. |
| `onboarding.cleanup_failed` | A cleanup step failed and the connection record was retained. | Inspect the named step and fresh connection state. A subsequent removal requires the current `etag`. |
| `onboarding.connection_busy` | Another request is still applying a provider effect to this connection (`retryable: true`). | Unlike `412`, the record did not change underneath you. Wait briefly, re-read, and resend the identical request with the same key if the write is still needed. |
| `412` / `428` | The conditional write used a stale `etag` or omitted `If-Match`. | Read the latest connection and review the intended change against that state. |
| `idempotency_key_required` / `idempotency_key_reused` | A write omitted its key or reused one for a different request. | Compare the actual request and key with the earlier attempt. Identical retries retain the key; a changed request needs a new one. |
| `idempotency_request_in_progress` | An attempt with that key is still running. | Allow it to finish and read state before deciding whether another write is needed. |
| `validation_failed` | The request failed validation. | Inspect the named field and diagnostic issue against the current input schema. |

For provider findings and access checks, read [AWS](aws.md). For controller failures, use the relevant [Terraform](terraform.md), [CloudFormation](cloudformation.md) or [scripts](scripts.md) reference.

After a timeout or lost response, read state before deciding to repeat a write. Assess retries using the returned details, `retryable` and any retry instructions; HTTP status alone does not establish the cause. If repeated attempts add no evidence, preserve request IDs and explain the unresolved condition to the customer or support.
