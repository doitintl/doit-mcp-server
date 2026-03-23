#!/bin/bash
# DoiT API Example: Query Costs by Service
#
# This example demonstrates how to query the DoiT Platform Analytics API
# to get costs grouped by service for the last 30 days.
#
# Usage:
#   DOIT_API_KEY=your_api_key ./query-costs-by-service.sh

set -euo pipefail

if [[ -z "${DOIT_API_KEY:-}" ]]; then
  echo "Error: DOIT_API_KEY environment variable is required" >&2
  exit 1
fi

curl -s -X POST 'https://api.doit.com/analytics/v1/reports/query' \
  -H "Authorization: Bearer ${DOIT_API_KEY}" \
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
  }' | jq '.'
