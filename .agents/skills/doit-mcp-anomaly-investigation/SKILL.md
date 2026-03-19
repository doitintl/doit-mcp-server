---
name: doit-mcp-anomaly-investigation
description: Investigate AWS and GCP anomalies with DoiT MCP plus cloud-specific MCP follow-up. Use when the agent needs to analyze a cost anomaly, spending spike, suspicious SKU or service charge, root-cause an anomaly from DoiT context, or decide which AWS or GCP MCP tools to call before giving recommendations.
---

# DoiT MCP Anomaly Investigation

Start from DoiT anomaly context, then branch into AWS or GCP inspection. Keep every follow-up call read-only and tightly scoped.

## Investigation Order

Use this order unless the user already supplied a specific anomaly payload:

1. `get_anomalies` or `get_anomaly` on DoiT MCP
2. Choose the cloud path from the anomaly details
3. Run cloud-specific MCP follow-up
4. Summarize root cause, evidence, and next actions

If the request is only about SKU mapping in the codebase, use the repo SKU-mapping skills instead of this skill.

## DoiT MCP First Pass

- Use `get_anomalies` when the user asks for recent or top anomalies.
- Use `get_anomaly` when the anomaly ID is already known.
- Extract the cloud, account or project, time window, service, and any SKU-like labels before touching AWS or GCP MCP.
- If DoiT MCP already answers the question, stop there.

## GCP Path

The GCP MCP in this repo exposes two stable tools:

1. `check_gcp_access_permission`
2. `gcp_account_access`

Always call `check_gcp_access_permission` before `gcp_account_access`.

### GCP Workflow

1. Call `check_gcp_access_permission` with the target `projectId` and `customerId`.
2. If access is not ready, stop and report the required action.
3. If access is ready, call `gcp_account_access` with a small read-only program.
4. Break multi-step investigations into multiple `gcp_account_access` calls instead of one broad script.

### GCP Script Rules

- Use only `@google-cloud/*` SDKs.
- Return the minimum serializable data needed to answer the question.
- Keep each script focused on one hypothesis.
- Prefer narrowing by project, service, resource name, and time window from the anomaly.
- If the first script reveals a likely resource family, run a second script against that family instead of expanding scope.

### GCP Anomaly Sequence

Use this progression for SKU or service anomalies:

1. Confirm the affected project and service from DoiT MCP.
2. Check access with `check_gcp_access_permission`.
3. Use `gcp_account_access` to inspect the smallest relevant inventory or config surface.
4. Use another `gcp_account_access` call for logs, metrics, or policy details only if the first pass leaves a live hypothesis.

## AWS Path

The AWS service in this repo is a proxy around `awslabs.core-mcp-server`, so do not assume fixed tool names beyond standard MCP discovery.

### AWS Workflow

1. Initialize the AWS MCP session for the correct customer context.
2. Call `tools/list`.
3. Select the smallest read-only billing, cost, logging, or resource inspection tools that match the anomaly.
4. Run billing and usage context first, then resource or event inspection second.
5. If the AWS MCP tool list does not expose a needed capability, say so instead of inventing a tool.

### AWS Priorities

- Prefer cost or billing evidence before deep resource inspection.
- Use CloudTrail, CloudWatch, or service-specific inspection only after the cost spike has been localized.
- Keep calls narrow by account, region, service, and time range.

## Output Rules

- Tie every conclusion back to evidence from DoiT MCP or the cloud MCP.
- Separate confirmed cause, likely cause, and unresolved questions.
- Recommend next actions only after identifying the cost driver.
- If a missing permission blocked the investigation, state that clearly and stop.
