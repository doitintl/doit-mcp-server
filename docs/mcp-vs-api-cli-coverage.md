# MCP Server Coverage vs Public API and CLI — Research

_Date: 2026-08-17. Snapshot-based analysis conducted from the omni monorepo (the external API's source of truth); re-run the comparison before acting on exact numbers. The 40-operation gap described below is the state this research found — PR #219 refreshed the snapshot and closed it._

## TL;DR

- The public API (`api.doit.com`) exposes **170 operations**; the spec source of truth (`services/external-api/openapi.yaml` in the omni monorepo) is **byte-identical in operation coverage to the live spec** — the spec→API pipeline is healthy and automated.
- The CLI (`dci`, [doitintl/dci-cli](https://github.com/doitintl/dci-cli)) loads the live OpenAPI spec at runtime (restish OpenAPI loader, default base `https://api.doit.com`), so it **tracks the API automatically — no gap by construction**.
- The MCP server (this repo, hosted at `mcp.doit.com` and published to npm as `@doitintl/doit-mcp-server`) builds its tools from a **checked-in, manually refreshed OpenAPI snapshot** (`src/tools/generated/openapi.json`). At research time that snapshot was last refreshed **2026-07-13** and covered **130 of 170 operations → 40 operations (≈24%) were missing from MCP**.
- The missing 40 are concentrated in newer API areas: PerfectScale for Commitments AWS (10), Billing Transfer (8), Contracts (6), Contract Templates (5), Budget Suggestions (3), Billing Explainer (2), Customers settings (2), Support ticket update/tags (2), CloudFlow build (1), Service Quotas (1).
- **The MCP pipeline is only semi-automated.** Tool generation from the snapshot is automatic at build/load time, but the snapshot refresh (`yarn generate:refresh-spec`), npm publish, and worker redeploy are all manual with no CI cadence and no drift alarm.

## The three surfaces

### 1. Public API (source of truth)

- Spec: `services/external-api/openapi.yaml` in the omni monorepo (170 operations, 30+ tags), served live at `https://api.doit.com/openapi.yaml`. Verified identical operation sets on 2026-08-17.
- Contract validation: Schemathesis spec-driven validation (omni `services/external-api/`) checks the deployed API against the spec (GET pass + stateful CRUD chains).
- New operations are designed against omni's `.agents/skills/agent-first-api-design/SKILL.md`; the AgentLedGrowth spec (omni `specs/AgentLedGrowth/CMP-49790-alg-cloud-intelligence/TECH.md`) states the principle explicitly: "The OpenAPI document is the product. MCP tools are generated from services/external-api/openapi.yaml."

### 2. MCP server (this repo)

Architecture (post v0.16.0, 2026-07-13):

- **~97 hand-written tools**, each declaring `coversEndpoint` (the API operation it wraps) or `coversEndpoint: null` for tools with no API equivalent (cost helpers `cost_breakdown` / `cost_trend` / `compare_spend` / `get_cloud_overview`, session tools `change_customer` / `confirm_action`, `search_customers`).
- **Auto-generated tools** for every remaining spec operation not covered by a hand-written tool (`src/tools/generated/generateTools.ts`) — one MCP tool per operation, Zod schemas derived from the OpenAPI schemas, pagination notes, read-only/destructive annotations, and an injected `customerContext` param.
- Tools are generated from `src/tools/generated/openapi.json` — a **pre-dereferenced static snapshot** of the live spec, refreshed via `node scripts/refresh-generated-spec.mjs` (default source `https://api.doit.com/openapi.yaml`). The script header says: run manually whenever the spec changes; it is *not* fetched at runtime because the Cloudflare Worker transport has no filesystem.
- Transports: stdio (npm package) and hosted Streamable HTTP/SSE at `https://mcp.doit.com` — a Cloudflare Worker (`doit-mcp-server.doitintl.workers.dev`; DNS is managed in omni, `infra/envs/prod/index.ts`). The worker consumes this package's `/core` entry; the worker wrapper itself (OAuth, Durable Objects, widgets) lives in a separate private repo. MCP OAuth (token exchange, client assertions) is handled by omni's `services/auth-service`.
- Related internal repo: `doitintl/doit-external-api-mcp` — the original fully spec-generated stdio server the generator was ported from. It supports `EXTERNAL_API_SPEC_PATH` to point at a live spec, i.e. it has no staleness problem, but it is stdio-only and internal.

### 3. CLI (`dci`)

- Go binary built on [restish](https://rest.sh) with its OpenAPI loader; default API base `https://api.doit.com`. Command surface is derived from the **live spec at runtime**, so every published operation is a command with generated flags/args — no per-command maintenance and no drift.
- Adds agent-oriented value on top of raw API access: machine-readable command catalog (`dci commands --json`), name→ID resolution, destructive-action contract, CSV/pivot output, docs command, skills, self-update.
- No operation exclusion list was found — CLI coverage = full API coverage (170 operations) plus auth/utility commands (`login`, `status`, `query`, …).

## Gap at research time: 40 API operations missing from MCP (closed by PR #219)

Computed as (operations in the live spec) minus (operations in the MCP snapshot). Nothing in the snapshot was absent from the live spec, and none of these 40 were covered by hand-written tools — this was pure snapshot staleness accumulated since 2026-07-13. The snapshot refresh in PR #219 exposed 31 of these as generated tools and excluded 9 by policy (`src/tools/generated/excludedOperations.json`).

### Billing Explainer (2)

- GET /billing/v1/billing-explainers/{invoiceMonth} — Retrieve a per-payer billing explainer
- GET /billing/v1/billing-profiles/{billingProfileId}/billing-explainers/{invoiceNumber} — Retrieve an entity invoice explainer

### Billing Transfer (8)

- POST /billingtransfer/v1/resellerhandshakes — Create reseller handshakes (batch)
- GET /billingtransfer/v1/programmanagementaccounts — List program management accounts
- POST /billingtransfer/v1/end-customer-mappings — Create end-customer mappings (batch)
- GET /billingtransfer/v1/programmanagementaccounts/status — Get program management account status
- GET /billingtransfer/v1/end-customers — List end-customers under a reseller PMA
- GET /billingtransfer/v1/resellers/{resellerPmaAccountId}/end-customers — List end-customers under a reseller PMA, by reseller PMA alone
- GET /billingtransfer/v1/reseller-accounts — List the caller's reseller PMA nodes
- GET /billingtransfer/v1/reseller-accounts/end-customers — List the caller's reseller PMA nodes with their end-customer tenants

### Budget Suggestions (3)

- GET /analytics/v1/budget-suggestions — List budget suggestions
- POST /analytics/v1/budget-suggestions/{id}/actions/accept — Accept a budget suggestion
- POST /analytics/v1/budget-suggestions/{id}/actions/dismiss — Dismiss a budget suggestion

### CloudFlow (1)

- POST /cloudflow/v1/flows/actions/build — Build a new CloudFlow from scratch

### Contract Templates (5)

- GET /billing/v1/contract-templates — List contract templates
- POST /billing/v1/contract-templates — Create contract template
- GET /billing/v1/contract-templates/{templateID} — Get contract template
- PUT /billing/v1/contract-templates/{templateID} — Update contract template
- DELETE /billing/v1/contract-templates/{templateID} — Archive contract template

### Contracts (6)

- GET /customers/{customerID}/contracts — List contracts
- POST /customers/{customerID}/contracts — Create contract
- GET /customers/{customerID}/contracts/{contractID} — Retrieve a contract
- POST /customers/{customerID}/contracts/{contractID} — Update contract
- POST /customers/{customerID}/contracts/{contractID}/activate — Activate contract
- POST /customers/{customerID}/contracts/{contractID}/cancel — Cancel contract

### Customers (2)

- GET /customers/v1/customers — Get customer general settings
- PATCH /customers/v1/customers — Update customer general settings

### PerfectScale for Commitments AWS (10)

- GET /ps4commitments/v1/aws/organizations — List AWS organizations
- GET /ps4commitments/v1/aws/organizations/{managementAccountId} — Get an AWS organization
- GET /ps4commitments/v1/aws/organizations/{managementAccountId}/member-accounts — List member accounts under an organization
- GET /ps4commitments/v1/aws/organizations/{managementAccountId}/member-accounts/{memberAccountId} — Get a member account
- GET /ps4commitments/v1/aws/organizations/{managementAccountId}/savings-plans — List AWS Savings Plans
- GET /ps4commitments/v1/aws/organizations/{managementAccountId}/reserved-instances — List AWS Reserved Instances
- GET /ps4commitments/v1/aws/organizations/{managementAccountId}/recommendations — List AWS recommendations
- GET /ps4commitments/v1/aws/organizations/{managementAccountId}/recommendations/{serviceId} — Get an AWS recommendation
- GET /ps4commitments/v1/aws/organizations/{managementAccountId}/planned-purchases — List AWS planned purchases
- GET /ps4commitments/v1/aws/settings — List organization engine settings

### Service Quotas (1)

- GET /core/v1/service-quotas — List service quotas

### Support Requests (2)

- PATCH /support/v1/tickets/{ticketId} — Update a request
- GET /support/v1/tickets/{ticketId}/tags — List tags on a support request

## Pipeline automation assessment

| Stage | Automated? | Detail |
|---|---|---|
| Spec (omni) → live `api.doit.com/openapi.yaml` | ✅ Yes | Deployed with the external API; verified identical. Schemathesis validates spec↔deployment. |
| Live spec → CLI commands | ✅ Yes (runtime) | restish loads the spec per invocation/cache; zero-lag coverage. |
| Live spec → MCP snapshot (`openapi.json`) | ❌ Manual at research time | Was `yarn generate:refresh-spec` run by a maintainer (last run 2026-07-13, no CI cron, no drift check). Now automated by `.github/workflows/refresh-spec.yml` (PR #219): daily cron + `repository_dispatch`, opens a review PR. |
| Snapshot → MCP tools | ✅ Yes (build/load time) | `generateTools.ts` emits a tool per uncovered operation; hand-written coverage tracked via `coversEndpoint` so nothing double-registers. |
| MCP release → npm | ✅ Yes (on tag) | `release.yml`'s `publish-npm` job publishes via npm Trusted Publishing (OIDC, no token) after verifying the tag matches `package.json`. |
| npm → hosted worker (`mcp.doit.com`) | ❌ Manual / separate repo | Worker imports `@doitintl/doit-mcp-server/core`; redeploy cadence not visible from the public repo. |
| MCP docs (help.doit.com tool list) | ❌ Manual | The docs list a curated subset and lag the generated tools. |

**Net effect:** the single point of drift for the whole agent surface is the manual snapshot refresh in `doit-mcp-server` (plus the manual publish/redeploy chain behind it). Every other stage is generated or validated automatically.

## Recommendations

1. **Automate the snapshot refresh** — ✅ implemented in PR #219: `.github/workflows/refresh-spec.yml` runs `scripts/refresh-generated-spec.mjs` daily (plus `workflow_dispatch` and `repository_dispatch` type `openapi-spec-updated`) and opens a review PR when `openapi.json` changes. Daily polling was chosen over a cross-org push trigger: the omni-side dispatch would need a credential that can reach this repo, and the org's shared cross-repo GitHub App is deliberately read-only.
2. **Add a drift alarm** — ✅ covered by the same workflow: the daily run surfaces divergence as a PR instead of letting it accumulate silently.
3. **CI hook in omni**: a post-merge step when `services/external-api/openapi.yaml` changes that fires the `repository_dispatch` at this repo (e.g. `gh api repos/doitintl/doit-mcp-server/dispatches -f event_type=openapi-spec-updated`). Not yet implemented.
4. **Automate npm publish on tag** — ✅ implemented (CMP-47733): `release.yml` publishes to npm via Trusted Publishing on every semver tag; see `docs/release.md`.
5. **Docs**: generate the help.doit.com MCP tool list from the same snapshot (or mark it explicitly as a curated highlights list) to avoid a third manually-synced surface. Not yet implemented.
6. **Decide intentional exclusions explicitly** — ✅ mechanism implemented in PR #219 (`src/tools/generated/excludedOperations.json`, enforced by `generateTools.ts` and guarded by `src/tools/generated/__tests__/excludedOperations.test.ts`). The nine seeded entries (Billing Transfer batch writes, Contracts writes, Contract Templates writes) are **proposals pending a product decision** — delete an entry to expose that operation.

## Reproducing the comparison

```bash
# operations in the live spec
curl -s https://api.doit.com/openapi.yaml -o /tmp/live-openapi.yaml
node -e "const y=require('js-yaml'),f=require('fs');const s=y.load(f.readFileSync('/tmp/live-openapi.yaml','utf8'));let n=0;for(const p of Object.values(s.paths))for(const m of ['get','post','put','patch','delete'])if(p[m])n++;console.log(n)"

# operations in the bundled MCP snapshot (from this repo's root)
node -e "const s=require('./src/tools/generated/openapi.json');let n=0;for(const p of Object.values(s.paths))for(const m of ['get','post','put','patch','delete'])if(p[m])n++;console.log(n)"
```
