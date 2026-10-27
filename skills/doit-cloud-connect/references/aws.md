# AWS walkthrough

Use this after selecting AWS in the main skill. The current API supports individual AWS accounts through seven operations; it has no diagnostics or event-reporting endpoint. Organization roots and OUs are deployment targets only. Use the response's provider variant, payer association, identity trust and artifact parameters.

For a root/OU rollout or an existing organization controller, follow [AWS organizations](aws-organizations.md) first. The account workflow below supplies requirements, registration reconciliation and verification for each account; it does not provision an organization or return its management template.

## Discover and resolve

1. Identify the account, the requested features and the authoritative deployment source (Terraform, CloudFormation stack/StackSet or other controller). Validate the 12-digit account ID (digits only; a letter `o` is not a zero) and any organization root/OU target (`r-…`, `ou-…`) before using them.
2. `list_cloud_connections` with the exact account filter, following `pageToken`, then read matches with `get_cloud_connection`. Use the current record and requested outcome to decide whether to verify, update or remove it; avoid a duplicate role or registration.
3. `get_cloud_connect_requirements`. Omitting `featureIds` is discovery: it returns every available feature at this scope with no selection and no satisfied artifact. Call again with the explicitly chosen features to resolve them. The selected-feature response is the only authority for permissions, inputs and artifacts, and its `catalogVersion` is what mutations must carry.

Use the tool and field descriptions to interpret the selected artifact. Artifact findings `feature_selection_required`, `missing_required_inputs` and `artifact_feature_unsupported` keep `requirementsSatisfied` false alongside the preconditions below; `feature_unsupported_at_scope` rejects the request itself. Resolve reported blockers, using the provider findings below to distinguish DoiT prerequisite work from cloud changes, then request fresh requirements. Establish cloud resources and access through customer-side discovery and verification.

Parameter spelling examples: `real-time-data`, `spot-scaling` and `expert_advice` differ on purpose. Keep those names when using the returned artifact. For an adapted implementation, make the mapping into its own interface explicit in the proposed change; do not add unsupported artifact arguments or normalize names blindly.

## Trust and ownership

`identity.trust` gives the DoiT principal and External ID (the DoiT customer ID, the same value for every account; do not generate a random one). Only the Terraform artifact returns `trustStatements`, its full cross-account `Allow sts:AssumeRole` policy; an omitted `externalId` means that statement is unconditional. The CloudFormation artifact has none: read the role's trust policy in the downloaded template and compare it with `identity.trust`. Compare every statement with the rendered plan or change set and surface unconditional or broader grants. Unexpected differences block deployment.

For a fresh AWS installation, prefer `doitintl_dci_cloudconnect` through the current deployment artifact. Keep existing AWS role ARNs and names, including `doitintl-cmp`, when updating or repairing an installation.

Before creating roles or stacks, list what already exists. Customer cases show the same failures repeatedly:

- Fixed role names (`doitintl-cmp`, `DoiT-Support-Gateway`, `doitintl_cmp`, `doitintl_dci_cloudconnect`) collide with roles from an earlier CloudFormation stack, StackSet, another DoiT product or a Service Catalog stack. Find the owning stack first. Do not delete a role to "make the retry pass", and never rename it blindly (a `…_2` role leaves the old one authoritative elsewhere).
- Moving from CloudFormation to Terraform: do not delete the old stacks and recreate roles. Deleting or rewriting the billing role (`doitintl_cmp`) or the support gateway can stop cost ingestion while Cloud Connect still looks healthy. Import or hand off ownership deliberately and keep one owner per role.

## Deployment methods

Apply the shared [deployment rules](deployment-tools.md), then read the relevant [Terraform](terraform.md), [CloudFormation/StackSets](cloudformation.md) or [scripts](scripts.md) reference. Template constraints, module registration behavior and method-specific recovery examples live there.

## Reconcile registration

The artifact's `registration` describes the original implementation. For an adapted deployment, determine whether it retains the provider resource or callback; otherwise registration is an explicit API call. Follow the final implementation's registration path:

- Retained `provider` (DoiT Terraform provider) or `callback` (CloudFormation `DoitCmpHook`): the deployment registers the account. Wait for the controller's result, then `get_cloud_connection`. Never POST afterwards. An existing record does not prove the latest callback succeeded: check `registrationTime`, desired features and `followUps`. A feature-only stack update may not notify DoiT; see the CloudFormation reference.
- No automatic registrar (a `manual` artifact, or an adapted implementation without the provider resource or callback): the deployment only grants access and the agent registers explicitly. Confirm with `list_cloud_connections` that no record exists; an existing record needs reconciliation through a conditional update instead. Then run `dry_run_cloud_connection_change` (`register`), review the preview, and call `register_cloud_connection` with the same identity, binding, inputs and fresh `catalogVersion`. No returned artifact is `manual` today, so this path applies to adapted deployments. A new role can return `aws_broker_requires_registration` in the dry run; that is a known limit, not proof of access.

POST for an account that already has a record returns `409 connection_exists` with the existing `id`: read it and use a reviewed conditional update.

## Change, retry and disconnect

Registration, update and removal use an `Idempotency-Key`; the tools generate one when omitted and return it as `idempotencyKey`. Updates and removals also send the latest quoted `etag` as `If-Match`.

- One key per logical write. After a timeout or lost response, **read first**. If the write must be repeated unchanged, resend the identical request with the same key; never reuse a key for a different body.
- `update_cloud_connection` sends the complete desired features and inputs for the one binding (merge patch). It cannot add bindings or replace the identity. Re-sending the current desired state retries failed follow-ups. A `412` means the record changed: re-read and re-evaluate, do not overwrite.
- Dry-run every update and removal first and show side effects and customer cleanup. Confirm removals with the user unless they already authorized exactly that.
- `remove_cloud_connection` needs `cleanupScope=doit_only`. `deleted: true` means the record is gone. `409 cleanup_failed` keeps it: inspect the failed steps and use a fresh `etag` if another removal is warranted. Later `404` means already absent; do not recreate it to get a success response. Customer IAM, stacks and Terraform resources need their own reviewed change.

## Permissions and verification

For `core`, the complete returned managed-policy set (SecurityAudit, AWSSavingsPlansReadOnlyAccess, Billing) is an accepted alternative to the listed legacy actions. Do not require both or remove a valid existing alternative to match the other.

Call `verify_cloud_connect` after deployment, registration or repair. Completion requires baseline authentication passed, every selected feature's check `passed` with adequate coverage, and required follow-ups `succeeded`. `partial`, `not_checked`, truncated sampling and failed follow-ups leave verification incomplete.

Verification checks compare declared permissions and accepted managed policies; they do not evaluate inline policies, permission boundaries, SCPs or resource conditions. Describe a passing result as declared access verified, preserving those coverage limits. Real-time data and Expert Advice have their own runtime checks (bucket details, notification configuration, sampled object access; external integration status). These can fail because of bucket resource policies even when the role policy looks right. Notification setup must preserve existing customer notifications.

`recorded: false` means no cell of the observation was stored: the record or catalog changed, the record was recreated during the probe, or every checked cell already held a newer observation. Re-read before concluding; the response itself remains fresh evidence. Registration, callback outcome, follow-ups and verification are separate evidence. A healthy older record does not prove a new member callback succeeded, and healthy access does not establish that billing data has arrived.

## Findings and possible checks

Use the returned finding, authentication reason or failed check to decide which of these possibilities applies. An API error code alone does not establish an IAM problem.

| Finding or check | Possible checks |
|---|---|
| `aws_asset_not_associated` | Check the DoiT account association and payer metadata. This is a DoiT prerequisite; a cloud policy edit cannot satisfy it. |
| `aws_management_account_unrecognized` / `not_payer_account` | These are DoiT prerequisite findings. Compare the requested management account with the customer's actual organization and DoiT payer context; IAM changes cannot establish the required DoiT relationship. |
| `aws_broker_requires_registration` in a dry run | The broker cannot probe this new role before registration. Check whether other prerequisites remain, then assess the authorized registration path in the final implementation. This result alone does not verify access. |
| Authentication `failed` | Compare the returned reason with the deployed role ARN/identity, account, trust and External ID. Check the reported API operation before proposing a change. Feature checks marked `not_checked` provide no permission evidence. |
| `required_permission_missing` | Compare `missingPermissions` with fresh requirements, accepted managed-policy alternatives and deployed policies. If the evidence calls for an IAM change, adapt the owning source and review its plan. |
| `entitlement` / `catalog_preconditions` failed | Compare the selected features with fresh requirements and the customer's DoiT eligibility. Cloud IAM changes do not grant DoiT entitlement. |
| A real-time check or follow-up failed | Inspect the named operation, bucket/account/region, policies and existing notification configuration. Preserve customer notifications; a bucket-policy problem is one possible cause. |

## Tool map

| Intent | Tool |
|---|---|
| Resolve identity trust, permissions and artifacts | `get_cloud_connect_requirements` |
| Discover and read registrations | `list_cloud_connections`, `get_cloud_connection` |
| Preview register, update or remove | `dry_run_cloud_connection_change` |
| Register explicitly when the final deployment has no automatic registrar | `register_cloud_connection` |
| Change desired features or retry follow-ups | `update_cloud_connection` |
| Fresh access checks | `verify_cloud_connect` |
| Remove the DoiT record | `remove_cloud_connection` |
