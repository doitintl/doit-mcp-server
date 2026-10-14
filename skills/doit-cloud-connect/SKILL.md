---
name: doit-cloud-connect
description: Connect, verify, repair or disconnect AWS, Google Cloud and Azure access for DoiT Cloud Connect using DoiT MCP tools and the customer's existing deployment workflow.
license: MIT
metadata:
  doit/skill-version: "2"
  doit/api-contract: "onboarding/v2"
---

# DoiT Cloud Connect

Requires DoiT MCP tools and customer-authorized access to their deployment tooling.

Use this workflow for Cloud Connect access. Billing exports, account signup and data-ingestion completion are separate tasks. Loading the skill grants no permission to deploy or remove resources.

## Discover and resolve

Identify the customer's intended cloud scope, requested features and authoritative deployment source. Use `list_cloud_connections` with exact scope filters; follow pagination before concluding a registration is absent. Read an existing record with `get_cloud_connection` before changing it.

Call `get_cloud_connect_requirements`. Omit feature IDs only to discover the full scope slice, then call again with the explicitly selected features. Do not treat discovery as enabling all features. Use returned identity, inline permission sets, consumers, required/resolved inputs, preconditions, artifacts and follow-ups. A feature with unknown entitlement or unmet prerequisites is not ready to deploy. Resolve pending Azure consent in the customer's tenant, then call requirements again.

The generated [catalog](references/catalog.md) is an offline planning aid. The fresh requirements response wins when its version differs. Never deploy from the static half alone. A `catalog_version_stale` response requires another resolution and review of changed permissions/artifacts; no version-matching fetch loop is needed.

## Prepare and deploy

Read the relevant provider reference: [AWS](references/aws.md), [Google Cloud](references/gcp.md), or [Azure](references/azure.md). Read [deployment tools](references/deployment-tools.md) for local plan checks and evidence handling.

Prefer a change to the customer's existing Terraform/module/stack/controller source. Identify who owns the current role, service account, policy and registration; multiple bindings may legitimately cover the same feature. Preserve unrelated grants and avoid taking over resources controlled elsewhere.

Use only deployable artifacts returned for the selected features. Fill required inputs from cloud discovery and customer context, validate enumerations, and have the customer resolve ambiguous choices. Inspect the preview against the fresh response: intended identity and exact scope, trust/External ID, required grants and artifact parameters. Surface unexpected grant removals, replacements, shared-policy changes and unknown planned values. An incomplete preview remains explicitly unverified.

Prepare a reviewable patch and explain concrete effects before asking for deployment approval when the customer's workflow requires it. Carry existing authorization forward; the skill does not introduce a second approval for an already-authorized action. Execute through the customer's chosen controller and wait for its actual terminal result. A parent StackSet success alone does not prove each member finished.

## Reconcile registration and verify

Read the artifact's `registersConnection` value:

- `true`: the provider/resource owns registration. Inspect its result and read the resulting connection; never add a second POST.
- `callback`: wait for the deployment callback, then read the connection and relevant diagnostics. An existing record does not prove the latest callback completed.
- `false`: once access exists, run `dry_run_cloud_connection_change` with operation `register`. Address failed preconditions/live checks (see the AWS new-role dry-run limitation in the provider reference), review DoiT side effects, then call `register_cloud_connection` with the same identity, bindings, feature inputs and fresh catalog version.

Before updating, dry-run the exact scoped change using the latest returned `etag` as `expectedEtag`. A 412 means the record changed: read it again and re-evaluate the intended change instead of silently replacing the revision. POST must not bypass PATCH revision checks. Retry only failed/incomplete named follow-ups from the ledger, including unfinished prerequisites before dependent steps; do not re-run completed steps by recreating registration. Identity replacement is currently rejected: plan a separately reviewed registration transition instead of promising an in-place identity PATCH.

Call `verify_cloud_connect` after deployment/registration or repair. Completion requires the intended binding and desired features to be present, baseline identity checks to pass, every required feature check to pass with adequate coverage, and required backend follow-ups to succeed. `partial`, `not_checked`, empty or truncated sampling, stale evidence and failed follow-ups are not completion. Healthy access does not establish billing data arrival.

For inherited GCP organization access at a project, use verification with `scopeSelection.kind=at_scope`; ancestry is only a discovery aid. This targeted result has `recorded:false` and does not update registered-scope coverage. Record the actual target and sampled coverage in the result.

## Lost responses and interrupted work

After a timeout or lost mutation response, read/list first. Reconcile POST only with the identical identity and desired bindings; never replay it to change configuration. For PATCH, read the current record, compare the desired state and ledger, then use the exact reviewed change and observed etag. Successful sibling follow-ups remain completed; retry only unfinished prerequisite/dependent steps.

An interrupted teardown resumes by repeating the exact DELETE request after the API permits retry. Named PATCH follow-up retries reject teardown. If the lost DELETE completed, a read/list showing absence or a repeated DELETE returning 404 means the registration is already absent; do not recreate it merely to obtain a success response. Preserve remaining customer-cloud cleanup for separate review.

## Repair, diagnostics and disconnect

Use `explain_cloud_connect_failure` with the response request ID, connection ID, scope and a bounded time window. Distinguish DoiT observations from labelled customer reports. Review [failure codes](references/failure-codes.md) and fix the source-controlled grants or required inputs before another verification. Respect any retry timing; bound polling and explain a pending external prerequisite rather than claiming success.

Read `sources` and `partial` before interpreting diagnostic history. DoiT observations use `source:doit_logs`; customer reports use `source:customer_reports`, with provenance in `evidenceSource`. An unavailable source is not an empty successful query. `partial:true` means one source is unavailable; both unavailable return 503. `available` only means that query succeeded, not that all evidence has arrived. Missing history never proves a callback was absent or completed.

Keep source and event ID together: the same event ID in different sources represents distinct evidence. Follow `nextPageToken` with the original filters and bounded time window. A `409 diagnostics_cursor_invalidated` means source availability changed: discard that pagination traversal and start a fresh bounded query, without inserting recovered-source events after older pages. A fresh poll can find late arrivals; neither source promises a shared snapshot. DoiT logs and customer reports can have different retention windows. The tool exposes sanitized evidence, never raw log access.

Customer-side telemetry is opt-in. `report_cloud_connect_event` accepts classified deployment failures/context, never credentials or raw logs. Classify locally before calling a hosted tool. Publication acknowledgement can precede diagnostic visibility; partial publication may accompany a 503, and a fresh submission may receive new IDs. Limit retries to two, preserve that uncertainty and continue the onboarding task if telemetry fails. Use connection reads and verification to determine completion.

For disconnect, first read the connection and dry-run operation `remove` with `cleanupScope=doit_only` and the exact etag. Explain affected consumers, DoiT cleanup and any data loss; obtain the user's confirmation of those effects before removal unless already explicitly authorized. GCP DoiT cleanup may delete a BigQuery dataset and its contents. After `remove_cloud_connection`, inspect the returned cleanup result and read/list to reconcile uncertainty. Customer-owned IAM, stacks and Terraform resources require a separately reviewed change through their controller. Do not remove a shared role/principal while its ownership or consumers are unresolved.

## Tool map

| Intent | Tool |
|---|---|
| Resolve permissions, identity and artifacts | `get_cloud_connect_requirements` |
| Discover and read registrations | `list_cloud_connections`, `get_cloud_connection` |
| Preview registration, update or removal | `dry_run_cloud_connection_change` |
| Register access without a registration-owning controller | `register_cloud_connection` |
| Change binding/features or retry a named follow-up | `update_cloud_connection` |
| Fresh access checks | `verify_cloud_connect` |
| Diagnostic history | `explain_cloud_connect_failure` |
| Opt-in classified customer report | `report_cloud_connect_event` |
| Disconnect DoiT state | `remove_cloud_connection` |

The optional [host snippet](assets/agents-snippet.md) is for the customer to copy. Never edit their agent configuration merely because this skill was loaded.
