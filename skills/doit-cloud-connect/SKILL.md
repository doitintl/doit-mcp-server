---
name: doit-cloud-connect
description: Route DoiT Cloud Connect setup, verification, repair or disconnect by cloud provider and deployment method. AWS, including organization root/OU rollouts, Google Cloud and Azure management groups are supported.
license: MIT
metadata:
  doit/skill-version: "23"
  doit/api-contract: "onboarding/v2"
---

# DoiT Cloud Connect

Requires DoiT MCP tools and customer-authorized access to deployment tooling. Billing exports, account signup and data-ingestion completion are separate tasks. Loading this skill grants no permission to deploy or remove anything.

## Choose the provider and deployment method

Identify the cloud, target scope, requested features and outcome, and the customer's existing resource controller and execution workflow.

| Provider | Path |
|---|---|
| AWS | Supported. Read the [AWS walkthrough](references/aws.md). |
| Google Cloud (GCP) | Read the [GCP walkthrough](references/gcp.md). |
| Azure | Read the [Azure walkthrough](references/azure.md). |

Use the existing target identified in the user's prompt or source. Resolve an explicitly named target through read-only discovery. If the target is unspecified or required IDs remain unresolved, ask the user to supply or select it before changes. A CLI default, placeholder or missing ID does not select a target. Validate supplied IDs without silently substituting another scope.

The registration endpoint is authoritative for the registered identifiers. After registration, take the connection `id`, `bindings[].bindingId` and account, project, organization or Azure scope IDs from its response; use the latest connection read for an existing registration. Do not construct IDs from naming conventions or ask the user to invent a registration ID. The initial request supplies the selected existing cloud target; registration records it and does not create that cloud target. If the returned scope differs from the requested target, stop and reconcile before further changes.

Onboarding does not authorize creating a cloud account, subscription, tenant, project, organization or management group, or moving resources between them. Create or move these targets only when the user explicitly asks for that work. If a target is missing or inaccessible, explain the result and resolve it with the user; do not provision a replacement or expand to a parent scope. Required access identities and grants remain subject to the reviewed onboarding plan.

For a request spanning several clouds, handle each provider separately.

For AWS, distinguish a single account from an organization root/OU rollout before selecting an artifact. For organization setup, expansion, feature updates or recovery, read [AWS organizations](references/aws-organizations.md). Organization requirements return the management-account controller artifact; registration and verification remain per account.

For a supported provider, read the shared [deployment rules](references/deployment-tools.md) and the relevant method reference:

- [Terraform and OpenTofu](references/terraform.md), including Terragrunt.
- [CloudFormation and StackSets](references/cloudformation.md), including CDK and CLI commands that deploy stacks.
- [Scripts](references/scripts.md) for direct cloud CLI commands or procedural setup.

Read additional method references when adapting between formats or working across controllers. For another controller, use the shared rules and its own preview.

Choose the deployment method in this order, taking the first that applies:

1. The owner of an existing DoiT deployment for this target: keep its controller and workflow.
2. IaC already present in a repository or folder that deploys this target's infrastructure: extend it.
3. A cloud CLI, or a cloud provider tool connected to your client, that you can run here.
4. The cloud console in a browser the user controls. The user signs in and keeps control of credentials; never ask for or enter passwords or keys.
5. Steps for the user to run.

Having a tool installed, such as `tofu`, `terraform` or `aws`, does not count as existing IaC. Rule out 1 and 2 with the first workflow stage before choosing a later option.

## Shared workflow

After selecting a supported provider, use the stages relevant to the requested operation:

1. **Locate the customer's existing setup.** The working directory is often not the customer's repository. Do not conclude that no IaC exists because the current directory is empty, is not a git repository, or is a scratch or temporary folder. Search for existing deployment source before proposing anything new:
   - Check the current directory and its parents; sibling and common project locations such as `~/code`, `~/src`, `~/dev`, `~/projects`, `~/work` and `~/repos`; any repository or folder the user names; and remote repositories available through connected GitHub, GitLab or similar tools.
   - Look for `*.tf`, `*.tfvars`, `terragrunt.hcl`, `.terraform.lock.hcl`, `cdk.json`, `Pulumi.yaml`, CloudFormation or SAM templates, Atlantis, Spacelift, env0 or CI pipeline files, and references to the target account, project or tenant ID, a DoiT module or provider, or the role names `doitintl_cmp`, `doitintl_dci_cloudconnect` and `DoiT-Support-Gateway`.
   - If you find a plausible source, read it and treat it as the owning source: reuse its engine, backend, state, provider aliases and execution workflow, and add or change DoiT resources there instead of creating a parallel stack.
   - If several candidates match, or you are not sure which one owns this target, ask the user which one. Do not guess and do not start fresh.
   - Start a new standalone module only when the search finds nothing and you have told the user where you searched. Convenience or an installed CLI is not a reason to create one.
2. **Discover current state and ownership.** Use `list_cloud_connections` and `get_cloud_connection` to inspect registration state, and inspect the owning source before proposing new resources or registration. Preserve the registered identity and resource controller unless the user confirms a migration plan under the shared deployment rules.
3. **Agree the plan.** For a new setup or feature expansion, follow the [onboarding interview](references/onboarding-interview.md): investigate, ask only the open questions with a recommended option, and confirm the plan before changing anything.
4. **Get fresh requirements.** Use `get_cloud_connect_requirements` for the selected features, per-feature permissions, identity trust, inputs and deployment prerequisites. These describe required access; they do not prove deployment or live access.
5. **Inspect and adapt.** Use the customer's repository and IaC/CLI tools to inspect artifacts as reference implementations. Modify, compose or translate them while preserving authoritative requirements, provider constraints and unrelated grants.
6. **Review and validate.** Show the proposed patch and concrete effects. Use the controller's plan for cloud changes where available; explain what remains unverified. Before every `register_cloud_connection`, `update_cloud_connection` or `remove_cloud_connection`, call `dry_run_cloud_connection_change` with the same request, and preview again if the body or `etag` changes. When the preview matches the intended change and any confirmed plan, proceed without asking. Stop and report to the user when it fails a precondition or blocks the change, differs from the request (features, scope or identity), or shows a removal or DoiT-side cleanup that is not already authorized. Carry existing authorization forward.
7. **Execute and reconcile.** Deploy through the owning workflow and inspect terminal results. Use `register_cloud_connection` only when the final deployment has no automatic registrar (no retained DoiT Terraform provider resource or CloudFormation callback) and no connection exists yet; use `update_cloud_connection` or `remove_cloud_connection` for requested API changes. Preserve the final implementation's registration owner, avoid duplicate registration and follow the provider walkthrough's concurrency/retry rules.
8. **Verify and report.** Use `verify_cloud_connect` for fresh access checks and `get_cloud_connection` to inspect required follow-ups. Assess coverage and report observed results, remaining failures and uncertainty; keep registration, access health and data arrival distinct. In the final report, state where you looked for existing setup and what you found or did not find.

## Failures

Use the actual response details and customer environment to choose the next action. Read [Failure cases and possible checks](references/failure-cases.md), the selected provider walkthrough and relevant method guidance as needed. Possible checks are non-exhaustive. Preserve request IDs and explain unresolved conditions when repeated attempts add no evidence.
