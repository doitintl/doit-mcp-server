# Diagram, DataHub, and AWS contract validation

Validated on 2026-10-05 from an isolated checkout based on main.

## Changes

- Diagram selectors use the API's `scheme` and `statussheet` DTO keys. Selecting
  layers also selects their owning diagrams; combined selectors form a union of
  diagrams. Component loading is explicitly disabled by default, including on
  selected layers where the API otherwise defaults to enabling it. With component
  loading enabled and no layer selectors, the tool resolves layer IDs from diagram
  metadata and makes a second read. Empty selector arrays behave like omission.
- Component responses are typed as diagram/layer maps with an array of layer
  metadata on each diagram. Unfiltered discovery covers accessible application
  and infrastructure diagrams. Component fields retain the API's projections.
- DataHub export alone returns `{ "data": "<raw CSV or JSONL>", "pageToken": "<cursor or null>" }`.
  The cursor comes from `X-Next-Page-Token`. Missing or empty headers return null,
  including empty final-page bodies. Other generated tools retain their output
  shapes. The request helper adds an opt-in header callback without changing its
  default body parsing or error behavior.
- Supported-feature lookup advertises AWS and AWS standalone accounts and validates
  12-digit IDs. It does not advertise Azure tenant support. AWS account bucket
  descriptions identify real-time data.
- Dataset lookup describes name-based metadata retrieval and the schemaTemplate
  identifier rather than a full column schema. Dataset update now exposes the
  supported displayName and logoName fields alongside description; omitted fields
  stay unchanged and empty strings clear supplied fields. Preset/name constraints
  are described and validated by the API; the tool rejects null values.
- Event descriptions cover whole-request validation, duplicate IDs across the
  request, acceptance for asynchronous processing, dataset names as providers,
  fixed-key allowlisting, boolean values only for fixed is_marketplace, timestamps
  within 730 days of API time, and at most 255 metrics per event. The unsupported
  processing-time guarantee was removed.
- Diagram descriptions cover cloud resource-ID lookup and viewer/image URLs,
  category-specific search pagination and layer scope, fractional trendingPct,
  top-five resource/service results, twelve trend buckets, inclusive cost dates,
  the 200-relation cap, optional group membership, snapshot tag filtering, and
  activity user IDs. find_cloud_diagrams is a non-destructive mutation because it
  creates a filter and queues rendering.

The upstream cost-snapshot total calculation is unchanged and remains separate
follow-up work. Shared HTTP error handling and unrelated tools are outside this
change.

## Deterministic checks

- Yarn 1.22.22, frozen root and integration lockfiles.
- Node 20.20.2 and 22.23.2: 1,125 unit tests and 255 integration tests passed;
  builds passed on both versions.
- Schema parity: all 106 existing cases retained and passed.
- yarn check:dev, yarn check:ci, and git diff --check passed.
- Cursor tests exercise real fetch response headers through the request helper
  and shared dispatcher, CSV and JSONL bodies, special characters in cursors,
  final/empty pages, unrelated-tool output compatibility, and both selected and
  environment customer contexts in the query and X-Tenant-Id header.
- Legacy and modern MCP tools/call integration tests round-trip the cursor.
- A separate local smoke check fed the built core's export result through the
  current hosted response adapter. The body and cursor survived conversion and
  selected customer context reached both the query and tenant header. This was
  a deterministic check, not live hosted OAuth coverage.

## Redacted live evidence

The built local CLI was connected over actual stdio with an MCP client. The key
was taken from DOIT_OWN_CUSTOMER_API_KEY and passed as DOIT_API_KEY only in the
child process environment. No credential, dataset name, cursor, or record content
was logged.

| Tool/read | Redacted input | Outcome and assertion |
| --- | --- | --- |
| tools/list | None | find_cloud_diagrams advertised readOnlyHint=false. |
| get_cloud_diagram_components | Empty discovery selectors | Tool returned an error. A separate bounded HTTP diagnosis returned 401 Unauthorized, so no accessible IDs could be discovered for filtered live checks. |
| list_datahub_datasets | No filters | Succeeded; an existing dataset was selected in memory. |
| export_datahub_dataset_records, page 1 | Existing dataset name redacted; JSONL; 365-day window ending at validation time; maxResults=1 | Succeeded and exposed a non-empty cursor. |
| export_datahub_dataset_records, page 2 | Same dataset/window; opaque cursor redacted; maxResults=1 | Succeeded; one record returned. Cursor advanced and event IDs/record bodies differed. |

Re-run the bounded read harness explicitly after installing both sets of
requirements and building:

```sh
node test/integration/live/datahubDiagrams.mjs
```

The harness is excluded from the default test suite. It reads at most two pages
per candidate, considers at most four datasets, and never invokes rendering,
creates a dataset, or ingests an event. Assertion failures omit customer records.

## Cleanup and remaining coverage

No remote resource was created or modified, so no resource cleanup was needed.
Temporary hosted-adapter smoke files were removed. No event ingestion, dataset
update, rendering, or production write was performed. Diagram live reads remain
unavailable with the supplied customer credential (401). AWS supported-feature
validation and dataset updates have deterministic coverage, but were not exercised
live. Final-page header behavior is tested deterministically; the live dataset was
not exhausted. Live hosted OAuth and switched-customer sessions remain unverified.
The hosted deployment must consume the updated core package to receive these fixes.
