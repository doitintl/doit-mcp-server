# Terraform and OpenTofu

Read this when using Terraform, OpenTofu or Terragrunt, or adapting a returned Terraform module into another tool. Apply the shared [deployment rules](deployment-tools.md).

## Source, ownership and plan

- Identify the owning root module, backend/workspace and provider/module versions. Check which AWS account each module's provider configuration actually targets, including aliases and assumed roles. Directory names do not prove account identity; preserve the customer's existing layout and state boundaries.
- Adapt the existing resources or module call. When using the returned module, preserve its parameter spelling and types. For resources owned elsewhere, review an import or ownership handoff before adding another resource to manage the same object.
- Inspect a saved plan with the selected engine's JSON plan output (`terraform show -json` or `tofu show -json`). Compare identity, trust and grants with requirements; inspect `resource_changes` and `after_unknown` for replacements, deletions and unresolved values. Review changes to shared policies and billing/support roles before applying through the owning workflow.
- Use `external_id` from fresh `get_cloud_connect_requirements` output. Before applying, confirm that the planned role trust policy's `sts:ExternalId` condition equals that exact value. A successful plan does not establish this: the module accepts any string. Stop and correct a mismatch in the owning configuration before applying.

The DoiT module's supported features can be narrower than the catalog; a non-satisfied Terraform artifact means use a different supported path, not an invented module version or argument. When using the returned module, forward its structured parameters verbatim and keep its `source` as returned: it is a pinned Git source and ref, and a registry coordinate or another version can differ from the reviewed module. If translating the reference into another tool, account for the cloud resources and any required registration handoff explicitly.

When the final implementation retains the DoiT provider resource, that resource owns registration: after apply, read the connection, never POST.

## Examples and possible checks

**Wrong External ID.** If the error details and deployed trust identify a mismatched External ID, compare the existing configuration with fresh requirements. For a generated UUID used in place of the required value, review a correction in the owning configuration and whether the plan updates trust in place. A registration error alone is no reason to destroy the role or reorganize the customer's modules.

**IAM succeeded, registration failed.** A failed apply can leave resources successfully created. Compare the provider error with Terraform state, cloud state and the DoiT connection to identify what completed. The evidence may call for correcting inputs, resolving a DoiT prerequisite or allowing propagation before another plan. Preserve successful IAM changes; when the DoiT provider resource owns registration, retry through that resource rather than creating a second registration path.

**Module returned, customer uses Pulumi.** Inspect the returned module and map the required cloud resources into the existing program. If the adapted deployment omits the DoiT provider resource, add an explicit `register_cloud_connection` step after apply, as described in the AWS walkthrough. If an existing controller already owns registration, preserve it. Compare the resulting preview with requirements before applying.
