# Common Anomaly Patterns

Patterns observed in the DoiT Console codebase. Use these to form hypotheses faster — but always confirm with evidence.

## By Service (GCP)

| Service | Common Root Causes | What to Check |
|---------|--------------------|---------------|
| Compute Engine | Autoscaler spike, preemptible → on-demand fallback, GPU instances left running | Instance list by zone, instance group sizes, machine types |
| BigQuery | Expensive on-demand queries, slot reservation changes, streaming insert volume | Jobs list filtered by time window, bytes billed, slot usage |
| Cloud Storage | Egress spike (cross-region or internet), class A/B operation surge, nearline retrieval | Bucket metrics, access logs, storage class distribution |
| Cloud Run | Traffic spike causing autoscale, min-instances misconfiguration | Revision list, traffic split, min/max instance settings |
| Vertex AI | Training job left running, endpoint with high replica count | Training pipelines, endpoint traffic, deployed model count |
| Cloud Logging | Excessive log ingestion from noisy services | Log-based metrics, exclusion filters, log volume by source |

## By Service (AWS)

| Service | Common Root Causes | What to Check |
|---------|--------------------|---------------|
| EC2 | Autoscaling event, instance type upgrade, reserved → on-demand fallback | Running instances by type, ASG activity, RI coverage |
| S3 | Cross-region replication enabled, requester-pays misconfiguration | Bucket metrics, replication rules, request counts |
| RDS | Multi-AZ failover, storage autoscaling, snapshot retention | Instance details, storage allocation, backup config |
| NAT Gateway | Data processing spike through NAT | VPC flow logs, NAT gateway metrics by AZ |
| CloudWatch | Log ingestion spike, custom metrics explosion | Log group ingestion bytes, PutMetricData calls |
| Lambda | Invocation spike, duration increase, provisioned concurrency | Invocation metrics, duration P99, concurrency settings |

## By Anomaly Type

| Type | Typical Investigation |
|------|----------------------|
| `COST` + single SKU spike | Focus on the specific resource/operation in `topSkus` |
| `COST` + multiple SKU spike | Likely a service-level event (scaling, migration) — check service-level metrics first |
| `USAGE` anomaly | Check for workload changes, config drift, or new deployments |
| Recurring daily pattern | Check scheduled jobs, batch processing, or cron-triggered workflows |
| One-time spike then resolved | Likely a transient event — check deployment history and incident logs |

## Red Flags

- `operation: "RunInstances"` with unfamiliar instance types → possible unauthorized usage
- `SECURITY_BREACH` feedback on similar past anomalies → escalate immediately
- Cost spike with no corresponding usage increase → check pricing/commitment changes
- Multiple anomalies across services in the same account → possible account-level event
