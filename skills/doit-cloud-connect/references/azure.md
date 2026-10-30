# Azure Cloud Connect

Use `provider: azure`, `kind: azure_management_group`, `tenantId` and
`managementGroupId`. This covers a tenant root or child management group and its
descendants. Discover the actual group ID and subscription hierarchy; the root
usually has the tenant UUID, but the two identifiers have different meanings.
Take `tenantId` and `managementGroupId` from the prompt or the user's target selection. If either is missing, ask for it; read-only discovery can help the user choose an existing group. A tenant-only request does not select its root management group. When the user explicitly requests the tenant root, discover and verify its actual group ID. Do not infer the target from matching UUIDs, the Console's root prefill or the active CLI subscription. A supplied group that is not found or cannot be read is a stop for scope clarification, not permission to create one, choose a broader group or move subscriptions.

The connection is registered by tenant; this path selects one management-group binding. Inspect the tenant's existing registration even when the requested group differs, and reconcile a scope change through its owner.

Tenant BillingBenefits, Capacity and billing-profile grants are separate. Legacy
tenant records remain readable; this path does not deploy or verify those grants.

1. Inspect the signed-in Azure tenant, subscriptions, hierarchy, existing DoiT
   registration and the current IaC owner. Call `list_cloud_connections` with
   `provider: "azure"` or the exact Azure `scope` object. Omitting both defaults
   to AWS and can miss an existing Azure registration. The MCP tool accepts
   structured fields; the raw HTTP filter DSL is not a tool argument. Use an isolated Azure CLI configuration
   when appropriate. Keep customer credentials in their environment. Subscription
   Owner alone does not grant management-group access or role-assignment writes.
2. Request fresh requirements for the management group and desired features.
   Use the exact catalog IDs; the API maps them to legacy names internally. Review
   the returned DoiT application ID, script digest, role definitions, customer
   binding and concrete changes. The script defaults to a read-only plan; the plan
   does not prove write permission. Save the returned parameters as JSON and run
   `bash azure-setup.sh --plan parameters.json`; after reviewing the effects use
   `--apply` with the same file. Apply only already-authorized changes through
   the existing controller or reviewed script.
3. Register the returned existing DoiT application in the tenant if absent.
   Creating the enterprise application requires directory permission; assigning
   roles requires `Microsoft.Authorization/roleAssignments/write` at the selected
   group. The script does not elevate the operator. If authorized administration
   requires a Global Administrator's temporary root elevation, record the exact
   added grant and restore it afterward; do not assume an additional Owner grant
   is needed. See [Microsoft's elevation and removal procedure](https://learn.microsoft.com/en-us/azure/role-based-access-control/elevate-access-global-admin).
   Preserve other users' grants and tenant policies. Stop at a human
   verification or MFA challenge that needs the user.
4. Apply only the selected roles at the intended group. Shared Reader grants can
   serve several features. New registration checks the setup-written customer
   binding in each live grant description. Preserve grants with an unknown owner
   or a condition; reconcile them with their owner instead of overwriting them.
   Allow RBAC and hierarchy propagation before repeating or broadening changes.
   If a just-restored role appears in CLI readback but fresh API observations
   still fail or alternate, wait and repeat read-only verification. Do not add
   broader roles or claim success from one cached or transient pass.
5. Preview API registration with `identity.kind: azure_service_principal` and
   `identity.tenantId` matching the binding. Register once when no connection exists.
   The Azure script grants access and does not register. Do not combine a legacy
   Console session verification, which can register, with another POST.
   Take the saved connection `id`, `bindingId`, `tenantId` and `managementGroupId`
   from the registration response. Confirm that its scope matches the selected
   existing target, then use those returned IDs for subsequent operations.
6. Use `verify_cloud_connect` for a fresh check, then inspect the saved connection.
   Completed legacy Console deployment sessions cache success and are unsuitable
   for permission-loss checks. Fresh verification checks management-group access
   and unconditional role assignments for the DoiT principal at that exact scope.
   It does not evaluate every effective permission, deny assignment, feature
   prerequisite or data arrival. Failed, partial and not_checked are not passes.
7. Update selected features with the current strong ETag and the full desired
   feature list. Apply added IAM requirements before the update. A stale ETag or
   uncertain write requires a fresh read and reconciliation. Legacy multi-scope
   records require reconciliation before updates; preserve their other grants.
8. Preview disconnect with `cleanupScope: doit_only`. It removes the DoiT record.
   Customer role assignments and the enterprise application remain. Revoke only
   owned grants separately when authorized, after checking shared feature use.

Account signup, credit cards, billing exports and organization creation are separate
workflows. Do not create paid workloads to establish Cloud Connect access.
