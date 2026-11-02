# Onboarding interview

Use this for a new setup or a feature expansion when the user has not already decided every choice below. DoiT defines these questions; do not invent others. A customer can start with only an account or project ID, so investigate first and then ask only what remains open.

## Investigate before asking

Read-only discovery comes first:

- Existing Cloud Connect records: `list_cloud_connections` and `get_cloud_connection`.
- Requirements discovery: `get_cloud_connect_requirements` without `featureIds`. Each feature returns `status` `available`, `not_entitled` or `inputs_required`. AWS responses also return `provider.variant` (`management_account`, `organization_member` or `standalone`).
- Existing DoiT deployments, roles and service accounts, using the provider walkthrough's ownership checks.
- The customer's repository and tooling: Terraform, OpenTofu or Terragrunt source and state, CDK or other IaC, CI pipelines, and which cloud CLIs or connected tools you can run here.

## Ask at most three questions

Ask only the questions below whose answer you could not determine. Skip a question when the prompt or user already answered it, or when discovery leaves one sensible choice; state what you found instead.

Present each question with options A–C and D:

- **A** is your recommendation, followed by one sentence explaining it from what you found.
- **B** and **C** are the main alternatives.
- **D** lets the user describe something else.

Ask the questions together in one message. Answer the user's questions about an option before continuing, and update the recommendation when their answer changes what you know.

### 1. Scope

- **AWS:** ask when `provider.variant` is `management_account`. Recommend an organization root or OU rollout when the user wants the organization covered or other member accounts have no DoiT connection; otherwise recommend the single account. Organization rollouts follow [AWS organizations](aws-organizations.md). For any other variant, connect the single account without asking.
- **Google Cloud:** ask when the target could be an organization, a project or a dataset. Use the scopes in the [GCP walkthrough](gcp.md). For an organization, include the service-account host project in the plan, following that walkthrough.

### 2. Features

Recommend core plus every other feature whose discovery `status` is `available` or `inputs_required`. Offer core only as B, and a custom selection as D. Do not offer `not_entitled` features; mention them only when the user asks for one. If fresh requirements for the selection return `default_feature_required`, add the named feature.

Skip this question when the user named the features.

### 3. Deployment method

Skip it when an existing DoiT deployment is found: keep its owner, as the shared [deployment rules](deployment-tools.md) require. Otherwise recommend the first that fits:

1. The Terraform, OpenTofu or Terragrunt setup the customer already uses for this cloud.
2. Other IaC the customer already uses, such as CDK, Pulumi or a CI pipeline.
3. The returned artifact through a cloud CLI or connected tool you can run here, such as CloudFormation for AWS or the setup script for Google Cloud.
4. Step-by-step instructions the user runs, when you cannot run any of these here.

## Confirm the plan

After the answers, get fresh requirements for the selection and present one plan:

- Scope, features and the deployment method and owner.
- Resources to create or change, including identity, trust and any input values you propose (such as a real-time data bucket).
- How the account or scope is registered and which checks verify it.
- Anything you could not check.

Proceed after the user confirms. Confirmation covers the plan as presented. Stop and ask again when fresh requirements, a plan or preview, or a deployment result shows a different scope, features, identity or resources. The main skill's preview rule applies to each API write. Migration and removal follow their existing confirmation rules.
