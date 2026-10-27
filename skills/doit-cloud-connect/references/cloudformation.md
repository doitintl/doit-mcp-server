# CloudFormation and StackSets

Read this for CloudFormation, StackSets or CDK, including AWS CLI commands that create or update stacks. Apply the shared [deployment rules](deployment-tools.md).

For organization root/OU deployment, also read [AWS organizations](aws-organizations.md) for management-artifact discovery, prerequisites, member enrollment and recovery.

## Template and deployment constraints

Download the returned template and compare its SHA-256 with the artifact `version` (`sha256-<hex>`): the digest covers the exact bytes at `templateUrl`, before any edits. A mismatch requires fresh requirements and, if it persists, a corrected release. Keep this verified source when adapting the template or composing a change in the customer's existing source. Compare the final implementation with fresh requirements and review its change set; the published digest authenticates the original only. Deploy the reviewed final template rather than fetching a mutable URL again.

The DoiT Console deploys the member template in `us-east-1` with `CAPABILITY_NAMED_IAM`; these are Console command conventions, not fields of the requirements response. This deployment region is separate from the CloudTrail/real-time bucket region (`bucketRegion`); confirm both against the template you reviewed.

Organization requirements return the StackSet management template, which accepts one `DeploymentTargetID`, plus a versioned member-template dependency. Verify both sources and check the existing rollout before extending to another OU. This is a DoiT template constraint, not a general AWS StackSets limit. SCPs in member accounts can deny `cloudformation:CreateStack` for the execution role; that is a customer policy decision, not something to bypass.

## Source, ownership and rollout

- Find the owning stack, StackSet and authoring source, including CDK or other generators. Distinguish a new deployment from an update, OU expansion or migration. Inspect existing roles and per-account ownership before proposing another stack with the same fixed names.
- Review the final template, parameters and change set for replacements, removals, retained feature switches and registration hooks. When relying on `DoitCmpHook` to refresh registration, check whether its properties actually change; a policy-only edit may leave the callback uninvoked.
- Validate the actual root/OU targets against the customer's organization and inspect member stack instances and operation results. Parent completion alone does not establish every account's outcome. An existing role owned by another stack or product needs a compatible reuse or migration path; renaming or deleting it to clear a collision can break other integrations.

The requirements response emits only the selected switches as true and omits unselected ones. Leaving an omitted parameter at its previous value cannot disable a feature, so a narrower selection does not remove permissions. Keep unrelated parameters at their current values; explicitly review supported switch changes and resulting policy removals for requested revocations. Bundled baseline grants remain after narrowing. Treat CloudFormation feature removal as unqualified until you have inspected its change set.

The template bundles baseline read grants and its callback can initially discover every permission-supported capability, so the registered feature list can exceed the request. Narrowing desired selection does not revoke IAM or prove legacy consumers are disabled.

## Examples and possible checks

**Add a feature to an existing rollout.** Adapt the owning stack's source and create a change set with the returned parameters, keeping `NotificationUrl`/`UpdateNotificationUrl` at their current values. The returned `FeatureFlags` token reflects the selected features and switches so a changed selection updates the member template's hook. For StackSets, inspect propagation into both the management nested stack and member parameters: changing the parent hook alone does not refresh child hooks. A change set of only new policies with no hook update has not notified DoiT. After deployment, inspect each targeted account's result and read the DoiT connection. The callback refreshes permission-supported capabilities without changing a stored desired selection. If a desired-selection change is still needed, dry-run and apply a conditional update with the full desired feature list; do not POST a duplicate registration. Verify the intended features.

**Hook failure followed by a role collision.** A failed `DoitCmpHook` can roll the stack back. Current same-ARN callbacks can update an existing registration in place; a stored record alone is not a reason to unlink it. The first failed stack event, later rollback events and surviving resources can distinguish an original callback problem from a secondary role collision. Use that evidence to decide whether the owning stack needs a repair or a retry. Keep the stack ID, failed resource and CloudFormation `RequestId` with the DoiT request ID for support; DoiT-side logs are unavailable to the customer.
