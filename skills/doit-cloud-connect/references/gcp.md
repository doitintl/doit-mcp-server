# Google Cloud

Use the supported organization, project or dataset binding from requirements. Feature eligibility differs by scope. A folder is not a binding. Choose only the intended organization; do not register every organization visible to the service account.

The service account's home project is an identity fact, distinct from the project/dataset it accesses. Use its descriptor (`email`, `uniqueId`, `projectId`) and workload identity federation; never send a JSON private key. Resolve the impersonating principal from requirements. Use the returned [deployment recipe](gcp-deployment.md) for customer-controlled CLI setup when there is no existing IaC owner; the recipe does not register the connection.

Preserve existing IAM members when changing a custom role or dataset policy. Dataset access may additionally require project permissions; review every permission fragment. Empty tables or a truncated table sample cannot prove complete dataset access. Report the sampled resources and completeness explicitly.

Desired features are explicit selections, independent of today's health. A later successful permission probe must not re-enable a feature the customer disabled. Organization access is not inferred from ancestry: verify the actual target project with `at_scope`.

Log-sink, real-time-pipeline and discovery callbacks are separately named follow-ups. A failed follow-up leaves work pending even after successful registration. Fix its cause and retry only that stored step. Disconnect may delete the DoiT BigQuery dataset with contents in the relevant project; this is a concrete backend side effect, not merely removal of a local record.

Disconnecting a connection with BigQuery Lens configured also removes its sink metadata and the customer’s optimizer/cost simulation data through a named backend cleanup step. Inspect the dry-run data-loss disclosure. Failed cleanup leaves the connection available for exact DELETE retry; do not recreate it to retry cleanup.
