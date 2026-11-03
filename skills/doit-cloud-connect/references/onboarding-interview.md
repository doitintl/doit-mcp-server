# Onboarding interview

Use this for a new setup or a feature expansion when the user has not already decided every choice below. DoiT defines these questions; do not invent others. A customer can start with only an account, project or Azure tenant ID, so investigate first and then ask only what remains open.

## Investigate before asking

Read-only discovery comes first:

- Existing Cloud Connect records: `list_cloud_connections` and `get_cloud_connection`. For Azure, pass `provider: "azure"` or the selected Azure scope; omitting both defaults to AWS. Inspect the tenant's existing registration even when the requested management group differs.
- Requirements discovery: once the required scope identifiers are resolved, call `get_cloud_connect_requirements` without `featureIds`. Each feature returns `status` `available`, `not_entitled` or `inputs_required`. AWS responses also return `provider.variant` (`management_account`, `organization_member` or `standalone`).
- Existing DoiT deployments, roles and service accounts, using the provider walkthrough's ownership checks.
- The customer's repository and tooling: Terraform, OpenTofu or Terragrunt source and state, CDK or other IaC, CI pipelines, and what you can run here: cloud CLIs, cloud provider tools connected to your client (such as an AWS, Google Cloud or Azure MCP server), or a browser the user lets you control.

## Ask at most three questions

Ask only the questions below whose answer you could not determine. Skip a question when the prompt or user already answered it, or when discovery leaves one sensible choice; state what you found instead.

Present each question with options A–C and D:

- **A** is your recommendation, followed by one sentence explaining it from what you found.
- **B** and **C** are the main alternatives.
- **D** lets the user describe something else.

Ask the questions together when the needed discovery is available. If scope selection is required before requirements discovery (for example, an Azure tenant without a selected group), ask the scope question first, then investigate and ask only the remaining questions together. Answer the user's questions about an option before continuing, and update the recommendation when their answer changes what you know.

### 1. Scope

Skip this question when the prompt or user already selected the scope: for example "connect only this account", a management account with a root or OU target, or an explicit Google Cloud or Azure scope. Use that scope; do not offer a broader one.

- **AWS:** otherwise, ask when `provider.variant` is `management_account`. Recommend an organization root or OU rollout when the user wants the organization covered or other member accounts have no DoiT connection; otherwise recommend the single account. Organization rollouts follow [AWS organizations](aws-organizations.md). For any other variant, connect the single account without asking.
- **Google Cloud:** ask when the target could be an organization, a project or a dataset. Use the scopes in the [GCP walkthrough](gcp.md). For an organization, include the service-account host project in the plan, following that walkthrough.
- **Azure:** resolve `tenantId` and an existing `managementGroupId`, covering that group and its descendants. Ask when the group is not selected, including when only a tenant or subscription ID was supplied. Recommend an existing group matching the requested subscription coverage; offer the tenant root only for requested tenant-wide coverage, after verifying its actual group ID. Follow the [Azure walkthrough](azure.md); do not create a group, move subscriptions or broaden the scope to complete onboarding.

### 2. Features

Recommend every returned feature whose discovery `status` is `available` or `inputs_required`. Offer core only as B when `core` exists in that catalog; otherwise offer a narrower selection of returned features. Offer a custom selection as D. Azure uses the selected management group's catalog: do not invent a `core` feature or include separate tenant billing grants. Do not offer `not_entitled` features; mention them only when the user asks for one. If fresh requirements for the selection return `default_feature_required`, add the named feature.

Skip this question when the user named the features.

### 3. Deployment method

Skip it when an existing DoiT deployment is found: keep its owner, as the shared [deployment rules](deployment-tools.md) require. Otherwise recommend the first that fits:

1. The Terraform, OpenTofu or Terragrunt setup the customer already uses for this cloud.
2. Other IaC the customer already uses, such as CDK, Pulumi or Azure Bicep/ARM, through its existing execution workflow.
3. The returned artifact through a cloud CLI, or cloud provider tools connected to your client, that you can run here, such as CloudFormation for AWS or the setup script for Google Cloud or Azure.
4. The cloud console in a browser the user lets you control, when no CLI or connected tool is available. The user signs in and keeps control of credentials; never ask for or enter passwords or keys. Confirm before each submitting action, such as creating a stack or granting a role.
5. Step-by-step instructions the user runs, when you cannot use any of these here.

Azure requirements return a CLI plan/apply script. Using Terraform/OpenTofu or Bicep/ARM means adapting the requirements in that existing controller; do not present the returned script as a native module or template. Include the required directory and management-group grant permissions in the plan; subscription Owner alone is insufficient.

## Confirm the plan

After the answers, get fresh requirements for the selection and present one plan:

- Scope, features and the deployment method and owner.
- Resources to create or change, including identity, trust and any input values you propose (such as a real-time data bucket).
- How the account or scope is registered and which checks verify it.
- Anything you could not check.

Proceed after the user confirms. Confirmation covers the plan as presented. Stop and ask again when fresh requirements, a plan or preview, or a deployment result shows a different scope, features, identity or resources. The main skill's preview rule applies to each API write. Migration and removal follow their existing confirmation rules.
