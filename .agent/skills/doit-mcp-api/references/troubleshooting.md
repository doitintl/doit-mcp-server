# DoiT API Troubleshooting

Error handling patterns and debugging guidance for DoiT API integrations.

## HTTP Status Codes

| Status | Cause | Solution |
| -------- | ------- | ---------- |
| 400 Bad Request | Invalid dimension ID, malformed config | Verify dimension exists with `list_dimensions` |
| 401 Unauthorized | Invalid or expired API key | Check Bearer token, refresh if expired |
| 403 Forbidden | Insufficient permissions | Contact DoiT admin for access |
| 404 Not Found | Report/resource doesn't exist | Verify resource ID |
| 429 Too Many Requests | Rate limit exceeded | Implement exponential backoff |
| 500 Server Error | DoiT API issue | Retry with backoff, contact support if persistent |

---

## Error Response Structure

```typescript
interface DoitErrorResponse {
  error: {
    code: number;
    message: string;
    details?: any;
  };
}
```

---

## Common Issues

### Invalid Dimension ID (400)

**Symptom:** Query returns 400 Bad Request

**Cause:** Using a dimension ID that doesn't exist or is misspelled

**Solution:**

1. Call `list_dimensions` first to verify available dimensions
2. Check the exact ID returned by the API (e.g., `pricing_unit` not `usage_unit`)
3. Suggest similar dimensions if the requested one doesn't exist

### Authentication Failures (401)

**Symptom:** API returns "Unauthorized"

**Solutions:**

- Verify the Bearer token is correctly formatted
- Check token expiration
- Ensure the API key has not been revoked
- Confirm the correct environment (production vs staging)

### Rate Limiting (429)

**Symptom:** API returns "Too Many Requests"

**Solution:** Implement exponential backoff:

```typescript
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error.status === 429 && i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

## Common Scenarios

### Scenario 1: "Show me AWS costs by service for last month"

**Query Pattern:**

- Filter: `cloud_provider = 'amazon-web-services'`
- Group: `service_description`
- Time Range: `{ mode: 'last', amount: 1, unit: 'month' }`
- Metric: `cost`

### Scenario 2: "Compare Q1 vs Q2 2024 costs"

**Approach:** Run two separate queries with `customTimeRange`:

- Query 1: `from: "2024-01-01", to: "2024-03-31"`
- Query 2: `from: "2024-04-01", to: "2024-06-30"`

### Scenario 3: "What are my top 10 most expensive resources?"

**Query Pattern:**

- Group: `resource_name`
- Limit: `{ sort: 'desc', value: 10 }`
- Time Range: As specified or default to last 30 days
