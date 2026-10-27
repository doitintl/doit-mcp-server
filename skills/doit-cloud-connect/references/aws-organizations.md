# AWS organization root/OU onboarding

Use this for organization setup, expansion, feature updates and interrupted StackSet rollouts. Apply the [AWS account walkthrough](aws.md) per account and the [CloudFormation rules](cloudformation.md) to the deployment source.

## Choose the scope and owner

Identify the DoiT environment/customer, management account, requested features and one root (`r-…`) or OU (`ou-…`) target. Check the authenticated AWS account against the management account before submitting changes. Recursively enumerate the target and descendant OUs, following pagination; record expected member accounts and excluded accounts for an OU rollout. An empty or incomplete discovery is not fleet acceptance.

Discover existing parent stacks, nested stacks, StackSets and fixed roles before creating resources. The Console management template owns the fixed `DoiT-DCI-CloudConnect` StackSet and normally uses `doitintl_dci_cloudconnect`. Another parent or renamed role is not a safe way to extend an existing rollout. Use its owning source and execution workflow, or resolve migration first.

For already-connected members, compare their registered roles and owning stacks with the proposed StackSet. Existing per-account deployments may need cleanup or migration so the StackSet can manage permissions and future updates centrally. A legacy role name alone does not establish that need. Explain the specific conflict and transition to the user, follow the shared [migration confirmation rule](deployment-tools.md), and preserve unrelated billing/support resources. After migration, reconcile registration and verify required features.

The DoiT management template deploys a local management-account nested stack as well as member StackSet instances. **An OU-targeted rollout therefore changes the management account too.** Include it in the reviewed account set. AWS service-managed StackSets themselves exclude the management account and include descendant OUs. [AWS deployment behavior](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacksets-orgs-associate-stackset-with-org.html)

## Establish prerequisites and obtain the artifact

- AWS Organizations must use ALL features, with administrator access in the management account and CloudFormation StackSets trusted access activated. Confirm the resulting state; enabling access creates service-linked roles. [AWS prerequisites](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacksets-orgs-activate-trusted-access.html)
- The DoiT customer must already recognize the management payer through the normal billing/account-association workflow. Resolve `aws_asset_not_associated`, `aws_management_account_unrecognized` or `not_payer_account` through that workflow. CUR ingestion and billing-data arrival are separate observations.
- Missing member assets may be discovered by the normal deployment callback through a recognized management payer. `discoveryInputs.managementAccountId` is a requirements hint; it does not create that association. Do not replace a failed bootstrap with duplicate registration or fabricated asset records.
- `get_cloud_connect_requirements` accepts `aws_account` only and returns the account/member template and per-account Terraform module. It does not return a management artifact, root/OU input or fleet operation. Never put a root/OU into `scope.accountId` or derive a management URL by changing the returned member URL.

Obtain the management artifact and environment-specific parameters from the DoiT Console's **Create a role automatically → Link new account → AWS CloudFormation StackSet creation** flow, or the customer's existing authoritative IaC source. Record the exact source and hash the parent and member bytes reviewed. This locally recorded hash pins review evidence; it is not a requirements-issued management version. If the artifact cannot be obtained or its trust/callback configuration cannot be established, stop deployment at that handoff and explain what is missing.

Read both templates before composing the change. Compare every child role trust statement and External ID condition with fresh account requirements. An additional account-root principal without that condition broadens trust even when authentication and feature verification pass; resolve that source/requirements discrepancy before approving deployment. Preserve the selected environment's callbacks and member source. The current Console flow uses `us-east-1` and `CAPABILITY_NAMED_IAM`; the parent accepts one `DeploymentTargetID`. Inspect the actual version rather than assuming multi-OU support or synthesizing missing parameters from the account artifact.

## Review, submit and reconcile

Review the parent change set and child template/parameter changes against management plus the expected members. Include IAM grants, replacements, automatic enrollment and account-removal behavior. A parent change set alone cannot prove the per-member outcome. Respect SCP failures as customer policy decisions.

Save a private local rollout manifest before submission, then add returned identifiers immediately:

| Evidence | Record |
|---|---|
| Ownership and intent | Environment/customer, management account, authoring source/controller, selected features and per-account inputs |
| Scope | Root/OU, recursive expected members, excluded accounts, discovery time and unresolved membership |
| Reviewed deployment | Parent/child source hashes, parameter values, region, change-set ID and automatic removal setting |
| AWS progress | Parent/nested stack IDs, StackSet ID, operation IDs, instance results and first failure |
| DoiT progress | Per-account connection ID, callback evidence, desired features, follow-ups and fresh verification with coverage |

Keep secrets, raw plans and logs customer-side. This file is a recovery aid, not a new DoiT setup-run API.

Deploy through the owning management workflow. Inspect the management nested stack and every expected member instance, including operation results and reasons. Reconcile the expected account list with actual AWS membership; report missing, failed, pending and unexpectedly included accounts explicitly.

The retained `DoitCmpHook` registers accounts through callbacks. Wait for it and inspect stack events plus each account's connection. Do not POST registrations after successful callbacks. A preexisting healthy connection does not establish a new callback succeeded. For missing registration, inspect the failed custom resource and payer association before retrying; retain request IDs for support.

After callbacks, get fresh selected-feature requirements for each registered account, inspect its actual desired selection and required follow-ups, and run `verify_cloud_connect` per account. Callback-discovered capabilities may exceed the requested selection. Reconcile any requested desired-state change through a preview and conditional update using that account's current `etag`; it does not remove IAM grants. Report completion only when every expected account, including management, has terminal deployment success, registration, the intended selection, adequate fresh access checks and successful required follow-ups. Observe data arrival separately.

## Membership and feature changes

The current management template enables automatic deployment with `RetainStacksOnAccountRemoval=false`. Review the downloaded version: a new/moved-in member can receive resources, while moving out of scope can delete its stack and role. AWS deletion does not prove DoiT record or follow-up cleanup. Inspect both, and preview any separately authorized record removal. Preserve the payer/billing integration. Do not move an account merely to retry deployment.

Newly enrolled members inherit StackSet defaults, not earlier per-account overrides. Compare actual features, callbacks and input values after each membership change. Inspect excluded accounts as well as included descendants for OU coverage. [AWS automatic deployment behavior](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/stacksets-orgs-manage-auto-deployment.html)

Feature updates belong in the owning parent/source. Confirm feature switches and the `FeatureFlags` refresh token reach **both** member StackSet parameters and the management nested stack, and that each child's hook properties change. Some management template versions omit that token forwarding; parent notification or policy success then does not prove child registration refreshed. Inspect the selected bytes and live child results before declaring the update complete.

Real-time data needs explicit bucket ownership, account, region, notification and KMS design. Some management versions pass `RealTimeDataBucketName` only to management and omit it from member StackSet defaults. `RealTimeData=true` alone does not establish member resources. Do not copy the management bucket to every member without a reviewed shared-bucket design. If using per-account overrides, also solve future automatic enrollment. Verify notifications, sampled access and actual delivery separately for each intended account.

## Resume and partial failure

After interruption, read the manifest and rediscover AWS state before submitting anything. Locate the owning parent/nested stacks and StackSet; list running and recent operations, inspect their instance results and re-enumerate target membership. AWS can continue while the agent is stopped. A timeout or missing local response leaves submission outcome unknown.

Resume observation of an existing operation. Distinguish rollback, failed callbacks, pending operations and successful members before proposing a retry. Repair the owning source or prerequisite, then retry only the needed scope through that controller; do not invent another fixed-name StackSet, re-register successful accounts, or overwrite concurrent per-account API changes. If terminal cloud state remains uncertain, report the affected accounts and operation IDs rather than claiming fleet success.
