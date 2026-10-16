# Google Cloud deployment adapter

Source: Console `client/src/Pages/Settings/GCP/commands.ts` and `constants.ts`.
This recipe prepares access only. Call POST /connections after deployment, using
`gcloud iam service-accounts describe --format=json` to obtain the service account's
email, uniqueId and projectId. The descriptor is not a private key.

Resolve requirements immediately before editing the customer's owning IaC. Use
its exact scope-valid permission sets and additionalScopes; do not invent grants.
Preserve customer Terraform/Config Connector ownership. Review the plan with the
customer before applying. These commands illustrate the existing gcloud adapter;
read existing roles and IAM policies first and update rather than recreating them.

For project access, create `doit-cmp` in the chosen project and a project custom
role `doit_cmp_role` containing the union of permissionSet.permissions. Grant that
role to the service account on the project. Enable serviceusage.googleapis.com and
cloudresourcemanager.googleapis.com. The command forms are:

```sh
gcloud iam service-accounts create doit-cmp --project="$PROJECT_ID" --display-name='DoiT Console'
gcloud services enable serviceusage.googleapis.com cloudresourcemanager.googleapis.com --project="$PROJECT_ID"
gcloud iam roles create doit_cmp_role --project="$PROJECT_ID" --title='DoiT Console Service Account' --stage=GA --permissions="$PERMISSIONS"
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" --role="projects/$PROJECT_ID/roles/doit_cmp_role" --condition=None
```

For organization access, select a customer-owned service-account project, then use
`gcloud iam roles create ... --organization="$ORGANIZATION_ID"` and
`gcloud organizations add-iam-policy-binding "$ORGANIZATION_ID"` with role
`organizations/$ORGANIZATION_ID/roles/doit_cmp_role`.

For dataset access, create a uniquely named `doit-cmp-<suffix>` service account in
the dataset project. Create `doit_cmp_dataset_access_role` for the dataset
permissions. Create `doit_cmp_dataset_project_access_role` and a project binding
only if additionalScopes contains project permissions. Read the entire existing
dataset policy with `bq show --format=prettyjson "$PROJECT_ID:$DATASET_ID"`; add the
service-account/custom-role grant while preserving every existing access entry,
then use `bq update --source=reviewed_dataset_policy.json "$PROJECT_ID:$DATASET_ID"`.
Do not substitute an IAM policy replacement that erases authorized views.

All scopes require the exact fresh response identity.impersonatingPrincipal to
have roles/iam.serviceAccountTokenCreator on the selected service account:

```sh
gcloud iam service-accounts add-iam-policy-binding "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" --member="serviceAccount:$DOIT_IMPERSONATING_PRINCIPAL" --role=roles/iam.serviceAccountTokenCreator
gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project="$PROJECT_ID" --format=json
```

Supply the descriptor to POST /connections with credentialMode from requirements.
For features requiring Workload Identity Federation, stop if that identity or its
bootstrap prerequisites are unresolved; do not substitute a long-lived key.
DoiT-owned log-sink/realtime follow-ups are performed by the backend and tracked
on the connection. Verify effective permissions after registration; diagnose and
repair through the same owning IaC before verifying again.
