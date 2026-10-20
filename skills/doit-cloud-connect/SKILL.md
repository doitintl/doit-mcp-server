---
name: doit-cloud-connect
description: Connect, verify, repair or disconnect AWS access for DoiT Cloud Connect using DoiT MCP tools and the customer's existing deployment workflow.
license: MIT
metadata:
  doit/skill-version: "3"
  doit/api-contract: "onboarding/v2"
---

# DoiT Cloud Connect (AWS)

Requires DoiT MCP tools and customer-authorized access to their deployment tooling.

This API version supports AWS accounts only: seven operations, no diagnostics or event reporting. For Google Cloud or Azure, say it is not available through this skill; do not improvise with these tools. Billing exports, account signup and data-ingestion completion are separate tasks. Loading the skill grants no permission to deploy or remove anything.

## Discover and resolve

1. Identify the account, the requested features and the authoritative deployment source (Terraform, CloudFormation stack/StackSet or other controller). Validate the 12-digit account ID (digits only; a letter `o` is not a zero) and any organization root/OU target (`r-…`, `ou-…`) before using them.
2. `list_cloud_connections` with the exact account filter, following `pageToken`. An existing record changes the plan: read it with `get_cloud_connection` and update it instead of deploying a second role.
3. `get_cloud_connect_requirements`. Omit `featureIds` only to see what is available, then call again with the explicitly chosen features. The response has no inline catalog beyond what you asked for; it is the only authority, and its `catalogVersion` is what mutations must carry.

Interpret the response precisely:

- Gate deployment on the **selected artifact's** `requirementsSatisfied` and `findings`, not on feature-level flags or `preconditions` alone. Discovery returns non-satisfied artifacts with empty `parameters`; so do blocked ones. Clear the reported blockers and resolve again.
- `requirementsSatisfied` means entitlement, inputs, account prerequisites and artifact support are resolved. It does not prove the role, bucket, region or any cloud resource exists, nor that deployment will work.
- `aws_asset_not_associated`, `aws_management_account_unrecognized` and `not_payer_account` are DoiT-side prerequisites. A `discoveryInputs.managementAccountId` hint does not associate an undiscovered member account. Report the missing association step; do not retry IAM changes.
- Forward returned artifact `parameters` verbatim, including spelling and structure (`real-time-data`, `spot-scaling`, `expert_advice` differ on purpose). Never normalize hyphens/underscores or add parameters the artifact did not return.
- Real-time inputs (`bucketName`, `bucketRegion`) must come from the customer's actual cloud context. A 200 does not prove the bucket exists or that the region is right; preserve that uncertainty until verification.

## Prepare and deploy

Read [AWS](references/aws.md) and [deployment tools](references/deployment-tools.md). Prefer a change to the customer's existing Terraform/module/stack/controller source and preserve unrelated grants. Before creating anything, list existing IAM roles and stacks and identify who owns `doitintl-cmp`, `DoiT-Support-Gateway`, `doitintl_cmp` and other DoiT-named resources; never delete or replace a role another stack or product owns just to avoid a name collision.

Show the reviewable patch and its concrete effects. Carry existing authorization forward; this skill adds no second approval for an action the customer already authorized. Execute through the customer's controller and wait for its terminal result. A parent StackSet success does not prove each member finished.

## Reconcile registration

Read the artifact's `registration`:

- `provider` (DoiT Terraform provider) or `callback` (CloudFormation `DoitCmpHook`): the deployment registers the account. Wait for the controller's result, then `get_cloud_connection`. Never POST afterwards. An existing record does not prove the latest callback succeeded: check `registrationTime`, desired features and `followUps`. A feature-only stack update may not notify DoiT; see the AWS reference.
- `manual`: the deployment only grants access. Run `dry_run_cloud_connection_change` (`register`), review the preview, then `register_cloud_connection` with the same identity, binding, inputs and fresh `catalogVersion`. A new role can return `aws_broker_requires_registration`; that is a known limit, not proof of access.

POST for an account that already has a record returns `409 connection_exists` with the existing `id`: read it and use a reviewed conditional update.

## Change, retry and disconnect

Writes need `If-Match` (the latest `etag`) and an `Idempotency-Key`. The tools generate a key and return it as `idempotencyKey`. Rules:

- One key per logical write. After a timeout or lost response, **read first**. If the write must be repeated unchanged, resend the identical request with the same key; never reuse a key for a different body.
- `update_cloud_connection` sends the complete desired features and inputs for the one binding (merge patch). It cannot add bindings or replace the identity. Re-sending the current desired state retries failed follow-ups. A `412` means the record changed: re-read and re-evaluate, do not overwrite.
- Dry-run every update and removal first and show side effects and customer cleanup. Confirm removals with the user unless they already authorized exactly that.
- `remove_cloud_connection` needs `cleanupScope=doit_only`. `deleted: true` means the record is gone. `409 cleanup_failed` keeps it: retry with a fresh `etag`. Later `404` means already absent; do not recreate it to get a success response. Customer IAM, stacks and Terraform resources need their own reviewed change.

## Verify

Call `verify_cloud_connect` after deployment, registration or repair. Completion requires: baseline authentication passed, every selected feature's check `passed` with adequate coverage, and required follow-ups `succeeded`. `partial`, `not_checked`, truncated sampling and failed follow-ups are not completion. Checks compare declared permissions; they do not evaluate inline policies, boundaries, SCPs or conditions, so say "declared access verified", not "effective access proven". `recorded: false` means the observation was not stored (stale revision/catalog or concurrent write); re-read before concluding. Healthy access does not mean billing data has arrived.

## Failures

Use the exact `code`, `detail`, `details`, `retryable` and `requestId` from the error; do not infer cause from a bare HTTP status. See [failure codes](references/failure-codes.md). This API has no diagnostics endpoint: the customer's own CloudFormation stack events, Terraform output and CloudTrail are the evidence. Collect stack ID, failed resource and CloudFormation `RequestId` locally and give them with the DoiT `requestId` to support; DoiT-side Lambda logs are not readable by the customer. If the same failure repeats with the same evidence, stop and summarize the unresolved prerequisite instead of retrying.

## Tool map

| Intent | Tool |
|---|---|
| Resolve identity trust, permissions and artifacts | `get_cloud_connect_requirements` |
| Discover and read registrations | `list_cloud_connections`, `get_cloud_connection` |
| Preview register, update or remove | `dry_run_cloud_connection_change` |
| Register after a `manual` artifact | `register_cloud_connection` |
| Change desired features or retry follow-ups | `update_cloud_connection` |
| Fresh access checks | `verify_cloud_connect` |
| Remove the DoiT record | `remove_cloud_connection` |
