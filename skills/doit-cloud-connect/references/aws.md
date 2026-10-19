# AWS

Connections bind individual accounts. Organization roots and OUs are deployment targets only. Use the response's provider variant, payer association, identity trust and exact artifact parameters. Account association and recognized management-account prerequisites are DoiT-side; creating a role cannot satisfy them.

## Trust and ownership

`identity.trust` gives the DoiT principal and External ID (the DoiT customer ID, the same value for every account; do not generate a random one). An artifact's `trustStatements` lists its full cross-account `Allow sts:AssumeRole` policy; an omitted `externalId` means that statement is unconditional. Compare every statement with the rendered plan and surface unconditional or broader grants. Unexpected differences block deployment.

Before creating roles or stacks, list what already exists. Customer cases show the same failures repeatedly:

- Fixed role names (`doitintl-cmp`, `DoiT-Support-Gateway`, `doitintl_cmp`, `doitintl_dci_cloudconnect`) collide with roles from an earlier CloudFormation stack, StackSet, another DoiT product or a Service Catalog stack. Find the owning stack first. Do not delete a role to "make the retry pass", and never rename it blindly (a `…_2` role leaves the old one authoritative elsewhere).
- Moving from CloudFormation to Terraform: do not delete the old stacks and recreate roles. Deleting or rewriting the billing role (`doitintl_cmp`) or the support gateway can stop cost ingestion while Cloud Connect still looks healthy. Import or hand off ownership deliberately and keep one owner per role.
- `DoitCmpHook` rejects an account that already has a Cloud Connect record, and a failed hook rolls the stack back. If a record exists, read it rather than redeploying; if the hook failed, read the stack events for the original failure before any retry, because a retry then collides with the leftover role.
- Organization-level StackSets: the target is a root (`r-…`) or OU (`ou-…`), not an account ID. A retyped `o`/`0` is a common cause of silent failures. A second OU needs its own deployment path; one StackSet targets one OU. SCPs in member accounts can deny `cloudformation:CreateStack` for the execution role; that is a customer policy decision, not something to bypass.

## CloudFormation

Download the returned template and compare its SHA-256 with the artifact `version` (`sha256-<hex>`): the digest is over the exact bytes at `templateUrl` (`curl -sS -o member.yml <templateUrl> && shasum -a 256 member.yml`), not a re-serialized copy; `aws cloudformation get-template --output text` appends a newline and will not match. A mismatch requires fresh requirements and, if it persists, a corrected release; never edit the template to force it through. Review its parameters, trust and permissions, then deploy those exact local bytes with the template-body/file option, not the mutable URL.

Deployment requirements for the member template: deploy in `us-east-1` with `CAPABILITY_NAMED_IAM`. This deployment region is separate from the CloudTrail/real-time bucket region (`bucketRegion`); do not conflate them. Confirm both against the template you reviewed.

**Updating an existing stack.** Create and execute a change set with the returned parameters, keeping `NotificationUrl`/`UpdateNotificationUrl` at their current values. The `DoitCmpHook` custom resource re-runs only when its inputs change; the returned `FeatureFlags` value is derived from the selected switches so a feature-only update triggers the callback. A change set of only new policies with no hook update has not notified DoiT. After the callback, read the connection: it refreshes permission-supported capabilities but never changes a stored desired selection. If the record still lacks the newly deployed features, dry-run and apply the conditional update with the full desired feature list. That update records the new desired features; it is not a duplicate registration, so do not POST.

**Additions versus removal.** Requirements emits only the selected switches as true and omits unselected ones. Leaving an omitted parameter at its previous value cannot disable a feature, so a narrower selection does not remove permissions. Keep unrelated parameters (notification URLs, controller settings) at their current values, but for any feature the customer wants removed, explicitly review the supported switch change and the resulting policy removal. Do not promise an exact final IAM state from the returned subset; the bundled baseline grants also remain after narrowing. Treat CloudFormation feature removal as unqualified until you have inspected its change set.

The template bundles baseline read grants and its callback can initially discover every permission-supported capability, so the registered feature list can exceed the request. Read the registration afterwards; if narrowing the desired selection fits the request, preview and apply that conditional update. Narrowing desired selection does not revoke IAM or prove legacy consumers are disabled.

## Terraform

The module's supported features can be narrower than the catalog; a non-satisfied Terraform artifact means use a different supported path, not an invented module version or argument. The DoiT provider resource registers the account and stays the registration owner: after apply, read the connection, never POST. Forward the structured parameters verbatim.

## Permissions and verification

For `core`, the complete returned managed-policy set (SecurityAudit, AWSSavingsPlansReadOnlyAccess, Billing) is an accepted alternative to the listed legacy actions. Do not require both or remove a valid existing alternative to match the other.

Verification checks compare declared permissions and accepted managed policies; they do not evaluate inline policies, permission boundaries, SCPs or resource conditions. Real-time data and Expert Advice have their own runtime checks (bucket details, notification configuration, sampled object access; external integration status). They can fail because of a bucket resource policy even when the role policy looks right, and the notification setup must preserve any existing customer notifications. Registration, callback outcome, follow-ups and verification are separate evidence; a healthy older record does not prove a new member callback succeeded.

If a feature check fails only for a missing permission that your IaC source should grant, fix that source and apply in place; do not create a second role.
