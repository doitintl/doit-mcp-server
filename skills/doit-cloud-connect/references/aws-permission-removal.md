# Remove unused AWS feature permissions

Use this when a customer wants DoiT's AWS access for a feature they no longer use removed. It is a separate request from changing feature settings:

- **Changing feature settings** updates the desired features on the DoiT connection (`update_cloud_connection`) or in the DoiT Console. It does not change IAM in the customer's account.
- **Removing AWS permissions** changes the customer's IAM roles and policies through the controller that owns them. It never happens automatically when a feature is turned off in DoiT.

A narrower `get_cloud_connect_requirements` selection is not a removal plan either. It lists what the remaining features need; it says nothing about which existing grants are safe to delete. Do the cleanup only when the customer asks for it, and apply the shared [deployment rules](deployment-tools.md).

## 1. Establish the remaining state

1. Read the connection with `get_cloud_connection`: the desired features, role ARN, real-time bucket inputs and `followUps`. Confirm which features the customer wants to stop using and which must keep working.
2. Find the owner of each grant to be removed: the CloudFormation stack or StackSet and its parameters, the Terraform/OpenTofu configuration and state, or customer-managed IAM. Grants for one role can have several owners, for example a DoiT stack plus a customer-attached policy. Edit each grant only through its owner. Policy names and layout vary by template version, for example a separate Spot Scaling policy in older stacks, so inspect the role's actual attachments rather than assuming the current template.
3. Call `get_cloud_connect_requirements` with the remaining features. Its permissions, accepted managed policies and inputs are what must survive.

## 2. Identify what only the removed feature uses

Compare each grant that would be removed against the remaining requirements. Keep a grant when any remaining feature needs it, when it is `core` access (including the accepted managed policies SecurityAudit, AWSSavingsPlansReadOnlyAccess and Billing), or when it belongs to something outside Cloud Connect.

Preserve these unless the customer separately asks for their removal under the shared migration confirmation rule:

- The Cloud Connect role and its trust policy. Disconnecting the account is a different request (see the AWS walkthrough).
- The billing role (`doitintl_cmp`) and cost-ingestion access. It is a different role from `doitintl-cmp`, despite the similar name. Removing it can stop billing data while Cloud Connect still looks healthy.
- Support access outside the removed feature, and unrelated customer statements in shared policies.

Grants that look feature-specific can be shared:

- In the DoiT CloudFormation template, Kubernetes cluster connect, Spot Scaling and both commitment features share one write policy. Turning off one switch removes only its statements; the policy remains while another write feature is on.
- Spot Scaling also owns the `doitintl-asg-opt` EventBridge role. Expert Advice owns the `DoiT-Support-Gateway` and `SupportDiagnostics` roles and two OIDC providers; removing Expert Advice deletes them.
- The template's baseline read grants stay with the role. They are not removable per feature.

Treat this list as orientation; the reviewed change set or plan is the authority for what changes.

Do not substitute a manual detach or an SCP deny for an owner change. The owning stack or module reattaches a detached policy on its next update, and an SCP deny is invisible to verification, which reads attached policies. If the customer has already done either, record it and bring the owner in line.

## 3. Stop DoiT use first

If the removed feature is still in the connection's desired features, narrow it first. For write features such as Spot Scaling, this is what stops DoiT's automation; removing IAM alone only makes that automation fail.

1. `dry_run_cloud_connection_change` (`update`) with the full remaining feature list and inputs, then `update_cloud_connection` with the latest `etag`.
2. For real-time data, DoiT removes its S3 bucket notification and real-time record as follow-ups. These steps use the role's current S3 access, so wait until `get_cloud_connection` shows them `succeeded` before removing that access. A failed follow-up can be retried by re-sending the same desired state.

Removing IAM before narrowing leaves the feature selected but failing: health checks report missing permissions and the Console shows the feature broken. Tell the customer that a connection registered through the Console can still show the removed feature as missing permissions afterwards. Removing real-time access first makes DoiT's notification cleanup fail, leaving the notification on the customer's bucket.

## 4. Preview, confirm and apply through the owner

Prepare the change in the owning source and show the customer its preview:

- **CloudFormation / StackSets.** Set the removed feature's switch explicitly to `false`; omitting it keeps the previous value. Keep every other parameter, including `RoleToAddPolicyTo` and notification URLs, at its current value. Review the change set for the exact policies, statements and roles removed, and for any replacement of the Cloud Connect role. For StackSets, check that the parameter change reaches every targeted account. See [CloudFormation and StackSets](cloudformation.md).
- **Terraform / OpenTofu.** Remove the feature from the module input in the owning configuration and review the saved plan: only the intended policies, attachments and feature roles may be destroyed, with no role replacement. See [Terraform and OpenTofu](terraform.md).
- **Customer-managed IAM.** Read the complete current policy documents. Remove only the statements used solely by the removed feature, keeping unrelated statements, and review the resulting diff. See [Scripts](scripts.md) for direct CLI changes.

Explain each removal, what keeps working and which shared grants stay and why. Get the customer's confirmation of that concrete plan unless they already authorized exactly it, then apply through the owner's workflow.

## 5. Verify and report

1. Inspect the controller's terminal result for every targeted account: stack events or stack instance results, or the apply output.
2. Read the role's attached and inline policies and confirm the intended grants and feature roles are gone.
3. Call `verify_cloud_connect` for the remaining features. Every check should pass with adequate coverage. A removed grant that a remaining feature needed shows up here as `required_permission_missing`; restore it through the owner.
4. Report what was removed, what remains and why (shared, core, billing, support or unrelated grants), and anything not verified, such as inline policies, permission boundaries or SCPs outside the checks.

## Resume a partial cleanup

Cleanup can stop between steps: a narrowed connection with IAM unchanged, a failed real-time follow-up, a rolled-back stack, or a StackSet that updated only some accounts. Re-read the connection and the controller's current state rather than repeating earlier steps from memory. Then continue from the first incomplete step: retry failed follow-ups, fix the reported stack or plan error and preview again, and verify the remaining features before reporting completion.
