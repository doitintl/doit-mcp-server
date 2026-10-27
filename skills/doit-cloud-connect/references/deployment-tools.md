# Adapt deployment artifacts

Treat each returned artifact as a reference implementation that you inspect and adapt to the customer's environment. Use your judgment to modify it, compose a new implementation, or translate it into the customer's existing tooling. Preserve the required identity, trust, scope, permissions and provider constraints from fresh requirements. An artifact's format does not require the customer to adopt another tool or state store. Resolve reported prerequisites before treating an adapted implementation as ready.

For an existing installation, retain its registered identity and owning controller. Identity defaults in returned artifacts apply to new resources; preserve existing identity parameters when adapting requirements for an update.

Setup, resumption and failed verification do not authorize identity or controller migration. Diagnose permission failures and review authorized repairs on the existing identity. If migration is required, report it as separate work and stop that change.

Verify the original artifact's version or digest before adapting it. Keep the original and the proposed diff; validate the final implementation separately. Confirm who performs registration after adaptation: preserve the provider resource or callback, or use an explicitly supported registration handoff. Downloaded metadata alone does not establish what the adapted deployment does.

## Choose the relevant reference

Once the deployment method is identified, read the matching reference:

- [Terraform and OpenTofu](terraform.md): Terraform, OpenTofu or Terragrunt source, plans, state and recovery.
- [CloudFormation and StackSets](cloudformation.md): templates, StackSets, CDK and AWS CLI commands that invoke CloudFormation.
- [Scripts](scripts.md): composing or executing direct cloud CLI commands and procedural setup scripts.

Read multiple method references when the workflow crosses them: a Terraform provisioner runs a script, a returned script is translated into Terraform, or existing CloudFormation resources move to Terraform. Also read the source artifact's reference when needed to understand what an adaptation must preserve. Ordinary Terraform work does not require the scripts reference.

## Recognize the customer's toolchain

Identify the authoring source, resource controller, execution workflow and registration owner. These can be different layers: CDK source may produce CloudFormation deployed by a repository pipeline. Check compatibility for the customer's actual engine, provider and module versions.

| Tool or layer | Where to make and review the change |
|---|---|
| Terraform / OpenTofu, optionally Terragrunt | Follow the existing engine, unit configuration, backend and state boundaries. Edit owning source, including Terragrunt inputs, rather than generated cache files. |
| AWS CDK | Edit the owning constructs and review the synthesized CloudFormation and deployment changes. |
| Pulumi | Update the existing program and inspect its preview; identify how the resulting implementation registers with DoiT. |
| HCP Terraform, Atlantis, Spacelift, env0 or CI pipelines | Use the configured execution workflow, identity and state. A local apply under another identity or backend does not reproduce that workflow. |
| Service Catalog, Control Tower or Kubernetes controllers | Locate the owning provisioner and its source before changing resources it manages. |

## Shared IAM changes

When replacing an existing IAM policy, read its complete current contents and review the resulting diff. Preserve unrelated statements or bindings unless removing them is part of the requested change. Use targeted additions where supported.

## Deployment and registration evidence

Use the selected tool's preview where available. Syntax checks and read-only discovery cover different things; state what remains unverified when no reliable plan exists. For CDK, Pulumi or custom automation, preserve the authoring source, execution engine and registration owner.

Keep source files, credentials, state, plans and raw logs in the customer's environment. A local preview is customer-produced evidence. The API registration dry run previews backend effects and available live checks; it cannot validate undeployed IAM or an entire cloud plan. Account for the documented new-role probe limit, reconcile registration after deployment, then run fresh access verification.
