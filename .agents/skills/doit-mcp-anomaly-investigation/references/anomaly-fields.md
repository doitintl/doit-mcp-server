# Anomaly Field Reference

Fields returned by `get_anomaly` and `get_anomalies` from DoiT MCP. Use these to scope cloud follow-up calls.

## Core Fields

| Field | Type | Notes |
|-------|------|-------|
| `id` / `alertId` | string | Unique anomaly identifier |
| `customerId` | string | DoiT customer context |
| `platform` | string | See Platform Values below |
| `billingAccountId` | string | Scoping key for all queries |
| `serviceName` | string | May differ from cloud-native names — see `service-abbreviations.md` |
| `skuName` | string | SKU-level detail when available |
| `costOfAnomaly` | number | Total anomalous cost (USD) |
| `severity` / `severityLevel` | number | Integer — higher = more severe |
| `status` | string | `"ACTIVE"` or `"INACTIVE"` |
| `type` | string | `"COST"` or `"USAGE"` |
| `frequency` | string | `"HOURLY"`, `"DAILY"`, or `"WEEKLY"` |
| `startTime` | Timestamp | When the anomaly began |
| `timestamp` | string | ISO 8601 detection time |
| `value` | number | Observed value |
| `excess` | number | Difference above expected baseline |
| `source` | string | `"real-time"` or `"report"` |

## Platform Values

Use the `platform` field to choose the cloud path:

| Value | Cloud Path |
|-------|------------|
| `google-cloud` | GCP |
| `amazon-web-services` | AWS |
| `microsoft-azure` | Azure (no MCP follow-up available yet) |
| `snowflake` | Snowflake (no MCP follow-up available yet) |
| `datadog` | Datadog (no MCP follow-up available yet) |
| `databricks` | Databricks (no MCP follow-up available yet) |
| `openai` | OpenAI (no MCP follow-up available yet) |

## Top SKUs Breakdown

`topSkus` / `top3SKUs` is an array of:

```
{
  cost: number,
  resourceId: string,
  skuDescription: string,
  operation?: string       // e.g., "RunInstances", "CreateVolume", "CreateNatGateway"
}
```

Use `resourceId` and `operation` to narrow cloud-specific follow-up calls.

## Sensitivity Levels

| Value | Meaning |
|-------|---------|
| `-1` | Low — fewer alerts, only large spikes |
| `0` | Moderate (default) |
| `1` | High — more alerts, smaller spikes flagged |

## Customer Feedback Reasons

If an anomaly has `customerFeedback`, these are the possible reasons:

**Confirmed anomalous:** `SECURITY_BREACH`, `MISCONFIGURATION`, `UNINTENTIONAL_PROVISIONING`, `EXPECTED_COST_SPIKE`, `ANOMALOUS_OTHER`

**Marked non-anomalous:** `FAULTY_ANOMALY_DETECTION_MODEL`, `INCORRECT_DATA`, `LOW_IMPACT`, `NON_ANOMALOUS_OTHER`

Use feedback to understand if similar past anomalies were false positives.
