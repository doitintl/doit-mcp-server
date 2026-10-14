# Azure deployment adapter

Source: `cloudconnect/azure/onboarding.go` role mappings and CLI flow.
This adapter grants access only. POST /connections registers it after deployment;
do not POST again if the existing Console onboarding session already verified and
registered the same access.

Fetch fresh requirements and use identity.servicePrincipalObjectId from the live
lookup. If identity.status is pending_consent, complete the displayed tenant
admin-consent step and resolve again. An unresolved identity with any other error
requires diagnosis; consent cannot fix a missing backend secret or token failure.
Never infer a tenant principal ID from the application's global ID.

Inspect and preserve the customer's owning Terraform/Bicep/ARM configuration.
The role assignments are the distinct permissionSet.roles for selected features,
scoped to `/providers/Microsoft.Management/managementGroups/<managementGroupId>`.
Use the exact roleDefinitionId and servicePrincipalObjectId returned. Review the
plan before applying. The corresponding Azure CLI operation is:

```sh
az login --tenant "$TENANT_ID" --allow-no-subscriptions
az account show --query tenantId --output tsv
az role assignment list --assignee-object-id "$PRINCIPAL_ID" --fill-principal-name false --scope "$SCOPE" --query "[?scope=='$SCOPE' && ends_with(roleDefinitionId, '$ROLE_DEFINITION_ID')].id" --output tsv
az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal --role "$ROLE_DEFINITION_ID" --scope "$SCOPE"
```

Confirm the active tenant matches first. Create only absent assignments; the list
query filters roleDefinitionId because `--role <GUID>` does not reliably match.
Do not automatically elevate the signed-in administrator or expand scope. If the
customer lacks role-assignment permission, hand off the reviewed plan to the
management-group Owner. Wait for RBAC propagation, POST /connections, then perform
fresh verification. No Azure billing export or tenant-rooted savings-plan grant
is included in this management-group adapter.
