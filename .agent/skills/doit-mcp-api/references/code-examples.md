# DoiT API Code Examples

Multi-language examples for common DoiT API operations.

## TypeScript

### Query Costs by Service (Last 30 Days)

```typescript
interface DoitQueryConfig {
  config: {
    dataSource: string;
    metric: { type: string; value: string };
    timeRange: { mode: string; amount: number; unit: string; includeCurrent: boolean };
    group: Array<{ id: string; type: string; limit: { metric: { type: string; value: string }; sort: string; value: number } }>;
  };
}

async function getCostsByService(apiKey: string): Promise<any> {
  const queryConfig: DoitQueryConfig = {
    config: {
      dataSource: 'billing',
      metric: { type: 'basic', value: 'cost' },
      timeRange: {
        mode: 'last',
        amount: 30,
        unit: 'day',
        includeCurrent: false
      },
      group: [{
        id: 'service_description',
        type: 'fixed',
        limit: {
          metric: { type: 'basic', value: 'cost' },
          sort: 'desc',
          value: 25
        }
      }]
    }
  };

  const response = await fetch('https://api.doit.com/analytics/v1/reports/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(queryConfig)
  });

  if (!response.ok) {
    throw new Error(`DoiT API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
```

### Query AWS Costs by Region

```typescript
async function getAwsCostsByRegion(apiKey: string): Promise<any> {
  const queryConfig = {
    config: {
      dataSource: 'billing',
      metric: { type: 'basic', value: 'cost' },
      timeRange: { mode: 'last', amount: 1, unit: 'month', includeCurrent: false },
      group: [{
        id: 'region',
        type: 'fixed',
        limit: { metric: { type: 'basic', value: 'cost' }, sort: 'desc', value: 25 }
      }],
      filters: [{
        id: 'cloud_provider',
        type: 'fixed',
        inverse: false,
        values: ['amazon-web-services']
      }]
    }
  };

  const response = await fetch('https://api.doit.com/analytics/v1/reports/query', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(queryConfig)
  });

  return response.json();
}
```

---

## Python

### Query Costs by Service

```python
import requests
from typing import Any

def get_costs_by_service(api_key: str) -> dict[str, Any]:
    """Query DoiT API for costs grouped by service."""

    query_config = {
        'config': {
            'dataSource': 'billing',
            'metric': {'type': 'basic', 'value': 'cost'},
            'timeRange': {
                'mode': 'last',
                'amount': 30,
                'unit': 'day',
                'includeCurrent': False
            },
            'group': [{
                'id': 'service_description',
                'type': 'fixed',
                'limit': {
                    'metric': {'type': 'basic', 'value': 'cost'},
                    'sort': 'desc',
                    'value': 25
                }
            }]
        }
    }

    response = requests.post(
        'https://api.doit.com/analytics/v1/reports/query',
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        },
        json=query_config
    )
    response.raise_for_status()
    return response.json()
```

### List Available Dimensions

```python
def list_dimensions(api_key: str, dimension_type: str | None = None) -> list[dict]:
    """List available dimensions for grouping/filtering."""

    params = {}
    if dimension_type:
        params['filter'] = f'type:{dimension_type}'

    response = requests.get(
        'https://api.doit.com/analytics/v1/dimensions',
        headers={'Authorization': f'Bearer {api_key}'},
        params=params
    )
    response.raise_for_status()
    return response.json().get('dimensions', [])
```

---

## Go

### Query Costs by Service (Go)

```go
package main

import (
    "bytes"
    "encoding/json"
    "io"
    "net/http"
)

type Metric struct {
    Type  string `json:"type"`
    Value string `json:"value"`
}

type TimeRange struct {
    Mode           string `json:"mode"`
    Amount         int    `json:"amount"`
    Unit           string `json:"unit"`
    IncludeCurrent bool   `json:"includeCurrent"`
}

type Limit struct {
    Metric Metric `json:"metric"`
    Sort   string `json:"sort"`
    Value  int    `json:"value"`
}

type Group struct {
    ID    string `json:"id"`
    Type  string `json:"type"`
    Limit *Limit `json:"limit,omitempty"`
}

type Config struct {
    DataSource string    `json:"dataSource"`
    Metric     Metric    `json:"metric"`
    TimeRange  TimeRange `json:"timeRange"`
    Group      []Group   `json:"group"`
}

type QueryRequest struct {
    Config Config `json:"config"`
}

func getCostsByService(apiKey string) (map[string]interface{}, error) {
    query := QueryRequest{
        Config: Config{
            DataSource: "billing",
            Metric:     Metric{Type: "basic", Value: "cost"},
            TimeRange: TimeRange{
                Mode:           "last",
                Amount:         30,
                Unit:           "day",
                IncludeCurrent: false,
            },
            Group: []Group{{
                ID:   "service_description",
                Type: "fixed",
                Limit: &Limit{
                    Metric: Metric{Type: "basic", Value: "cost"},
                    Sort:   "desc",
                    Value:  25,
                },
            }},
        },
    }

    body, _ := json.Marshal(query)
    req, _ := http.NewRequest("POST", "https://api.doit.com/analytics/v1/reports/query", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer "+apiKey)
    req.Header.Set("Content-Type", "application/json")

    resp, err := http.DefaultClient.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()

    var result map[string]interface{}
    respBody, _ := io.ReadAll(resp.Body)
    json.Unmarshal(respBody, &result)
    return result, nil
}
```

---

## cURL

### Query Costs by Service (cURL)

```bash
curl -X POST 'https://api.doit.com/analytics/v1/reports/query' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "config": {
      "dataSource": "billing",
      "metric": {"type": "basic", "value": "cost"},
      "timeRange": {
        "mode": "last",
        "amount": 30,
        "unit": "day",
        "includeCurrent": false
      },
      "group": [{
        "id": "service_description",
        "type": "fixed",
        "limit": {
          "metric": {"type": "basic", "value": "cost"},
          "sort": "desc",
          "value": 25
        }
      }]
    }
  }'
```

### List Reports

```bash
curl -X GET 'https://api.doit.com/analytics/v1/reports' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```
