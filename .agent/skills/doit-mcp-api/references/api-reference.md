# DoiT API Reference

Detailed endpoint specifications and schemas for the DoiT Platform Analytics API.

## Endpoints

### run_query — Execute Ad-Hoc Analytics Query

**Use Case:** Query cost, usage, or savings data without persisting a report.

**Endpoint:** `POST /analytics/v1/reports/query`

**Request Schema:**

```typescript
interface ReportQueryConfig {
  config: {
    dataSource: 'billing' | 'billing_datahub' | 'bqlens';
    metric: {
      type: 'basic' | 'custom' | 'extended';
      value: string; // 'cost', 'usage', 'savings' for basic
    };
    timeRange?: {
      mode: 'last' | 'latest' | 'custom';
      amount: number;
      unit: 'day' | 'week' | 'month' | 'quarter' | 'year';
      includeCurrent: boolean;
    };
    customTimeRange?: {
      from: string; // RFC3339 format: "2024-01-01T00:00:00Z"
      to: string;
    };
    timeInterval?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
    group?: Array<{
      id: string;
      type: string;
      limit?: {
        metric: { type: string; value: string };
        sort: 'asc' | 'desc';
        value: number;
      };
    }>;
    filters?: Array<{
      id: string;
      type: string;
      inverse: boolean;
      values: string[];
    }>;
  };
}
```

---

### list_reports — Get Available Reports

**Use Case:** Retrieve saved reports the user has access to.

**Endpoint:** `GET /analytics/v1/reports`

**Filter Parameter:** `reportName:value|owner:value|type:value`

---

### get_report_results — Fetch Report Data

**Use Case:** Get results from a specific saved report.

**Endpoint:** `GET /analytics/v1/reports/{reportId}/results`

**Parameters:** `pageToken` for pagination

---

### list_dimensions — Get Available Dimensions

**Use Case:** Discover what dimensions can be used for grouping/filtering.

**Endpoint:** `GET /analytics/v1/dimensions`

**Filter Parameter:** `type:fixed|label|tag|attribution`

---

## Response Schemas

### Query Results

```typescript
interface QueryResults {
  schema: Array<{ name: string; type: 'string' | 'float' | 'timestamp' }>;
  rows: any[][];  // Each row matches schema columns
  forecastRows?: any[][];  // Forecast data if requested
  pageToken?: string;  // For pagination
}
```

### Parsing Results

```typescript
function parseQueryResults(results: QueryResults): Array<Record<string, any>> {
  const { schema, rows } = results;

  return rows.map(row => {
    const record: Record<string, any> = {};
    schema.forEach((col, index) => {
      let value = row[index];

      // Convert timestamp to Date
      if (col.type === 'timestamp' && typeof value === 'number') {
        value = new Date(value * 1000);
      }

      record[col.name] = value;
    });
    return record;
  });
}
```

---

## Validation Rules

| Field | Valid Values | Default |
| ------- | -------------- | --------- |
| `dataSource` | `billing`, `billing_datahub`, `bqlens` | `billing` |
| `metric.type` | `basic`, `custom`, `extended` | `basic` |
| `metric.value` (basic) | `cost`, `usage`, `savings`, `credit`, `discount` | `cost` |
| `timeRange.unit` | `day`, `week`, `month`, `quarter`, `year` | `day` |
| `timeRange.mode` | `last`, `latest`, `custom` | `last` |
| `timeInterval` | `hour`, `day`, `week`, `month`, `quarter`, `year` | — |
| `group[].limit.sort` | `asc`, `desc` | `desc` |
| `group[].limit.value` | 1-1000 | 25 |

### Dimension Validation

> [!IMPORTANT]
> Always verify dimension IDs before using them in queries. Use `list_dimensions` first if unsure about a dimension ID to prevent 400 Bad Request errors.

---

## Custom Date Range Format

```typescript
customTimeRange: {
  from: "2024-01-01T00:00:00Z",  // RFC3339 format
  to: "2024-01-31T23:59:59Z"
}
```
